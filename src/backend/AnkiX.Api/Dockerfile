FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY ["AnkiX.Api.csproj", "./"]
RUN dotnet restore "AnkiX.Api.csproj"

COPY . .
RUN dotnet publish "AnkiX.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
COPY --from=build /app/publish .

# Heroku assigns dynamic PORT environment variable at runtime
CMD CMD_PORT="${PORT:-8080}" && dotnet AnkiX.Api.dll --urls "http://0.0.0.0:${CMD_PORT}"
