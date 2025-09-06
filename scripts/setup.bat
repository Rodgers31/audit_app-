@echo off
REM Setup script for the Audit App development environment on Windows

echo 🚀 Setting up Audit App development environment...

REM Check if Docker is installed
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed. Please install Docker and try again.
    exit /b 1
)

REM Check if Docker Compose is installed
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker Compose is not installed. Please install Docker Compose and try again.
    exit /b 1
)

REM Create environment files if they don't exist
echo 📝 Creating environment files...

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo ✅ Created backend\.env from example
)

if not exist "frontend\.env.local" (
    echo NEXT_PUBLIC_API_URL=http://localhost:8000> frontend\.env.local
    echo NEXT_PUBLIC_APP_NAME=Audit App>> frontend\.env.local
    echo NEXT_PUBLIC_APP_VERSION=1.0.0>> frontend\.env.local
    echo ✅ Created frontend\.env.local
)

REM Build and start the services
echo 🏗️  Building Docker containers...
docker-compose build

echo 🚀 Starting services...
docker-compose up -d postgres redis

REM Wait for PostgreSQL to be ready
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 10 /nobreak

REM Run database migrations
echo 📊 Running database migrations...
docker-compose run --rm backend alembic upgrade head

REM Start all services
echo 🎉 Starting all services...
docker-compose up -d

echo.
echo ✅ Setup complete!
echo.
echo 🌐 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:8000
echo 📚 API Docs: http://localhost:8000/docs
echo 🗄️  PostgreSQL: localhost:5432
echo 🔴 Redis: localhost:6379
echo.
echo To view logs: docker-compose logs -f
echo To stop services: docker-compose down
