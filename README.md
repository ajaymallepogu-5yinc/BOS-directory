# OrgChart — Company Directory & Org Tree

A two-view org chart for the company:

- **Company Tree** — everyone, from the CEO down to individual contributors.
- **Department Tree** — pick a department (Leadership, Project, IT, HR & Ops, ...) and see just that slice of the org, with reporting lines preserved.

There's also an **Admin** screen for adding/editing/removing employees by hand, for when the data source is set to manual entry.

## Stack

- **Frontend:** React + TypeScript (Vite), Tailwind CSS, React Router, Axios.
- **Backend:** ASP.NET Core 8 Web API, Entity Framework Core, SQL Server.
- **Data:** pluggable — either your own database (manual entry through the Admin screen) or a read-only connection straight into your company's existing HR portal database. Switching between them is a one-line config change (see below), nothing in the rest of the app needs to change.

## Project structure

```
orgchart-app/
  backend/
    OrgChart.sln
    OrgChart.Api/
      Program.cs                 — startup, DI, the Local/HrPortal switch
      appsettings.json           — connection strings + DataSource toggle
      Models/                    — Employee, Department
      Dtos/                      — shapes returned to the frontend
      Data/                      — EF Core DbContext + sample seed data
      Repositories/
        IEmployeeRepository.cs       — the contract both data sources implement
        EfEmployeeRepository.cs      — manual-entry / your own DB
        HrPortalEmployeeRepository.cs — reads from the existing HR system (customize this)
      Services/
        OrgTreeBuilder.cs         — turns the flat employee list into the nested tree
      Controllers/                — Employees, Departments, Tree endpoints
  frontend/
    src/
      api/                       — typed API client
      components/OrgChart/       — EmployeeCard, TreeNode (recursive), legend
      components/Admin/          — table + add/edit form
      pages/                     — CompanyTreePage, DepartmentTreePage, AdminPage
```

## Running it locally

### Backend

You'll need the [.NET 8 SDK](https://dotnet.microsoft.com/download) and either SQL Server or LocalDB (comes with Visual Studio).

```bash
cd backend/OrgChart.Api
dotnet restore
dotnet run
```

This starts the API at `http://localhost:5226`. On first run it creates the database and seeds it with a small sample hierarchy (modeled on the chart you shared) so the UI has something to show immediately — open `http://localhost:5226/swagger` to poke at the endpoints directly.

### Frontend

You'll need [Node.js](https://nodejs.org) 18+.

```bash
cd frontend
npm install
cp .env.example .env   # adjust VITE_API_BASE_URL if your API runs on a different port
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). You should see the seeded sample org chart.

## Switching data sources: manual entry vs. your HR portal

This is controlled entirely in `backend/OrgChart.Api/appsettings.json`:

```json
{
  "DataSource": "Local",   // or "HrPortal"
  "ConnectionStrings": {
    "LocalDb": "...",
    "HrPortalDb": "..."
  }
}
```

- **`"Local"`** (default): employees live in your own database, managed through the **Admin** screen. Full create/edit/delete.
- **`"HrPortal"`**: the app reads employees straight from your company's existing HR database instead. This mode is **read-only on purpose** — real employee records should be edited in the HR system, not duplicated here. The Admin screen will show a message and disable editing automatically when this mode is on.

To wire up the real HR portal once you have access details:

1. Get the connection string and ask what the employee table/columns are actually called.
2. Open `Repositories/HrPortalEmployeeRepository.cs` — it's a clearly-commented adapter with a sample SQL query. Update the table/column names to match the real schema. That file is the *only* thing that needs to change; controllers, the tree logic, and the whole frontend keep working unchanged because they only ever talk to the `IEmployeeRepository` interface.
3. Set `"DataSource": "HrPortal"` and fill in `ConnectionStrings:HrPortalDb`.

## How the tree is built

Every employee has a `ManagerId` (null only for the CEO). `Services/OrgTreeBuilder.cs` takes the flat list and:

- **Company tree** — starts at whoever has no manager and nests everyone else underneath, recursively.
- **Department tree** — filters to just the people tagged with the chosen department, then treats anyone whose manager falls *outside* that department as a root of their own branch. That way a department view still shows real reporting structure instead of a flat list, even though department is just a label on each person rather than a separate reporting chain.

## Deploying later (AWS / Azure)

Not done yet by design — you said hosting comes after the product is solid. When you're ready, the shape of it will be:

- **Backend:** containerize with a `Dockerfile` (ASP.NET Core has an official base image) and run it on Azure App Service / AWS ECS or Elastic Beanstalk, with the database as Azure SQL or Amazon RDS.
- **Frontend:** `npm run build` produces a static `dist/` folder that can go straight onto Azure Static Web Apps, AWS S3 + CloudFront, or any static host — just set `VITE_API_BASE_URL` to the deployed backend's URL at build time.

Happy to put together the actual Dockerfiles and CI/CD pipeline when you get to that stage.
