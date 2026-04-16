import { NgModule } from '@angular/core';
import { SmokeTestsPage } from './pages/smoke-tests.page';
import { BackendHealthCheckComponent } from './components/backend-health-check/backend-health-check.component';
import { TypeormDatabaseClientComponent } from './components/typeorm-database-client/typeorm-database-client.component';

@NgModule({
  imports: [SmokeTestsPage, BackendHealthCheckComponent, TypeormDatabaseClientComponent],
  exports: [SmokeTestsPage, BackendHealthCheckComponent, TypeormDatabaseClientComponent],
})
export class TestingToolsModule {}
