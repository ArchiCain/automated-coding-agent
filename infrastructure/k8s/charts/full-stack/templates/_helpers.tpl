{{/*
Expand the name of the chart.
*/}}
{{- define "full-stack.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "full-stack.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "full-stack.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "full-stack.labels" -}}
helm.sh/chart: {{ include "full-stack.chart" . }}
{{ include "full-stack.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
managed-by: the-dev-team
{{- if .Values.global.taskId }}
task-id: {{ .Values.global.taskId }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "full-stack.selectorLabels" -}}
app.kubernetes.io/name: {{ include "full-stack.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "full-stack.backend.labels" -}}
{{ include "full-stack.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{- define "full-stack.backend.selectorLabels" -}}
{{ include "full-stack.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "full-stack.frontend.labels" -}}
{{ include "full-stack.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "full-stack.frontend.selectorLabels" -}}
{{ include "full-stack.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Database labels
*/}}
{{- define "full-stack.database.labels" -}}
{{ include "full-stack.labels" . }}
app.kubernetes.io/component: database
{{- end }}

{{- define "full-stack.database.selectorLabels" -}}
{{ include "full-stack.selectorLabels" . }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Keycloak labels
*/}}
{{- define "full-stack.keycloak.labels" -}}
{{ include "full-stack.labels" . }}
app.kubernetes.io/component: keycloak
{{- end }}

{{- define "full-stack.keycloak.selectorLabels" -}}
{{ include "full-stack.selectorLabels" . }}
app.kubernetes.io/component: keycloak
{{- end }}

{{/*
Host prefix for ingress rules
*/}}
{{- define "full-stack.hostPrefix" -}}
{{- if .Values.global.taskId }}
{{- .Values.global.taskId }}
{{- else }}
{{- .Release.Name }}
{{- end }}
{{- end }}
