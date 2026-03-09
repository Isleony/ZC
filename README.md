# Zona Perigosa - Crime Radar

App fullstack para monitorar ocorrencias reais em mapa com filtros por tipo, periodo e ranking de zonas de risco.

## Stack

- Frontend: React + Vite + React Leaflet
- Backend: FastAPI + psycopg
- Banco: PostgreSQL + PostGIS
- Orquestracao: Docker Compose

## Como rodar sem Docker (recomendado agora)

1. Backend (terminal 1):

```powershell
Set-Location d:/1000Devs/CrimeApp/backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

2. Frontend (terminal 2):

```powershell
Set-Location d:/1000Devs/CrimeApp/frontend
npm install
npm run dev
```

3. Acesse:

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`

Observacao: nesta execucao sem Docker, a API usa dados locais de exemplo (modo `local-sample-data`) para facilitar o teste imediato.

## Como rodar com Docker

1. No PowerShell, entre na pasta do projeto:

```powershell
Set-Location d:/1000Devs/CrimeApp
```

2. Copie variaveis de ambiente:

```powershell
Copy-Item .env.example .env
```

3. Suba tudo:

```powershell
docker compose up --build
```

## Endpoints

- `GET /health`
- `GET /incidents?hours=168&types=tiroteio&types=roubo`
- `GET /risk-zones?hours=168&limit=10`
- `GET /heatmap?hours=168`
- `GET /alerts/check?lat=-22.90&lng=-43.17&radius_km=2&hours=24`

## URLs

- Frontend: `http://localhost:5173`
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
