FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

COPY ["src/backend/AnkiX.Api/AnkiX.Api.csproj", "./"]
RUN dotnet restore "AnkiX.Api.csproj"

COPY src/backend/AnkiX.Api/ .
RUN dotnet publish "AnkiX.Api.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS final
WORKDIR /app
COPY --from=build /app/publish .

# Heroku assigns a dynamic PORT environment variable at runtime
CMD ["sh", "-c", "dotnet AnkiX.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
