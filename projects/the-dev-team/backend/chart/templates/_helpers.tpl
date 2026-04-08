{{/*
Common labels
*/}}
{{- define "the-dev-team-backend.labels" -}}
app: {{ .Release.Name }}
app.kubernetes.io/name: the-dev-team-backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
