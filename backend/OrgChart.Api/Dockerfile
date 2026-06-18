FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore NuGet packages
COPY ["backend/OrgChart.Api/OrgChart.Api.csproj", "backend/OrgChart.Api/"]
RUN dotnet restore "backend/OrgChart.Api/OrgChart.Api.csproj"

# Copy everything else and build the release
COPY . .
WORKDIR "/src/backend/OrgChart.Api"
RUN dotnet build "OrgChart.Api.csproj" -c Release -o /app/build

# Publish the release
FROM build AS publish
RUN dotnet publish "OrgChart.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Build the final runtime container
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Configure ASP.NET Core to bind to port 8080 (Railway's default exposed port)
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "OrgChart.Api.dll"]
