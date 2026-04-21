# Theme — Flows

## Flow 1: GET /theme — existing user

1. Client sends `GET /theme` with `access_token` cookie or `Authorization: Bearer <jwt>` header.
2. Global `KeycloakJwtGuard` decodes the JWT (no signature check) and sets `request.user = KeycloakUserProfile` (`app.module.ts:23-28`, `keycloak-jwt.guard.ts:46-57`).
3. Class-level `@UseGuards(KeycloakJwtGuard)` re-runs the same guard (`controllers/theme.controller.ts:18`).
4. `@KeycloakUser('id')` resolves `request.user.id` and passes it into `ThemeController.getTheme` as `userId` (`controllers/theme.controller.ts:31`).
5. Controller logs `GET /theme - userId: <id>` and calls `ThemeService.getTheme(userId)` (`controllers/theme.controller.ts:32-33`).
6. Service runs `userThemeRepository.findOne({ where: { userId } })` (`services/theme.service.ts:19-21`).
7. Row is found — service returns `{ theme: userTheme.theme, userId: userTheme.userId }` (`services/theme.service.ts:32-35`).
8. NestJS serializes the object as JSON with status `200`.

## Flow 2: GET /theme — first-time user (default creation)

1. Steps 1–6 as in Flow 1.
2. `findOne` returns `null` (`services/theme.service.ts:23`).
3. Service logs `No theme found for user <id>, creating default` (`services/theme.service.ts:24`).
4. Service calls `userThemeRepository.create({ userId, theme: 'dark' })` to build an unsaved entity (`services/theme.service.ts:25-28`).
5. Service calls `userThemeRepository.save(userTheme)` — INSERT into `example_schema.user_theme` with generated uuid, `theme='dark'`, timestamps from `CreateDateColumn` / `UpdateDateColumn` (`services/theme.service.ts:29`, `user-theme.entity.ts:20-24`).
6. Service returns `{ theme: 'dark', userId }` with status `200`.

## Flow 3: PUT /theme — update existing

1. Client sends `PUT /theme` with JWT and JSON body `{ theme: 'light' }`.
2. Guard attaches `request.user` as in Flow 1.
3. `@Body() updateThemeDto: UpdateThemeDto` binds the body. No `ValidationPipe` is registered globally, so `@IsEnum` is NOT enforced at this step — an invalid value is accepted by the controller (see spec Behavior and project overview Discrepancies) (`controllers/theme.controller.ts:45`, project `main.ts`).
4. Controller logs `PUT /theme - userId: <id>, theme: <value>` and calls `ThemeService.updateTheme(userId, updateThemeDto)` (`controllers/theme.controller.ts:47-48`).
5. Service calls `findOne({ where: { userId } })` (`services/theme.service.ts:46-48`).
6. Row exists — service mutates `userTheme.theme = updateThemeDto.theme` (`services/theme.service.ts:55-57`).
7. Service calls `save(userTheme)` — TypeORM issues an UPDATE statement; `updatedAt` auto-refreshes (`services/theme.service.ts:59`).
8. Service returns `{ theme, userId }` with status `200`.

## Flow 4: PUT /theme — first-time user (create-on-update)

1. Steps 1–5 as in Flow 3.
2. `findOne` returns `null` (`services/theme.service.ts:50`).
3. Service calls `create({ userId, theme: updateThemeDto.theme })` (`services/theme.service.ts:51-54`).
4. Service calls `save(userTheme)` — INSERT with the requested theme (`services/theme.service.ts:59`).
5. Service returns `{ theme, userId }` with status `200`.

## Flow 5: Unauthenticated request

1. Client sends `GET /theme` or `PUT /theme` with no cookie and no `Authorization` header.
2. Global `KeycloakJwtGuard` finds no token — throws `UnauthorizedException` (`keycloak-jwt.guard.ts:46-57`).
3. Nest's default exception filter responds with `401 Unauthorized`.
4. Neither controller nor service runs; no row is created.