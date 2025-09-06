#!/bin/bash
# START ALL API ENDPOINTS - Simple Script
# =====================================

echo "🚀 Starting Kenya Audit Transparency APIs..."
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "start_all_apis.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Start Enhanced County Analytics API (Port 8003)
echo "🔧 Starting Enhanced County Analytics API (Port 8003)..."
cd apis
python enhanced_county_analytics_api.py &
ENHANCED_PID=$!
cd ..

# Wait a moment
sleep 2

# Start Modernized Data-Driven API (Port 8004) 
echo "🔧 Starting Modernized Data-Driven API (Port 8004)..."
cd apis
python modernized_api.py &
MODERNIZED_PID=$!
cd ..

# Wait a moment
sleep 2

# Start Main Backend API (Port 8000)
echo "🔧 Starting Main Backend API (Port 8000)..."
cd backend
python main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for all to initialize
sleep 3

echo ""
echo "🎉 ALL APIs STARTED!"
echo "==================="
echo "📊 Enhanced County Analytics API: http://localhost:8003"
echo "🔧 Modernized Data-Driven API:    http://localhost:8004" 
echo "🏛️ Main Backend API:              http://localhost:8000"
echo ""
echo "📋 Process IDs:"
echo "• Enhanced API PID: $ENHANCED_PID"
echo "• Modernized API PID: $MODERNIZED_PID"
echo "• Backend API PID: $BACKEND_PID"
echo ""
echo "⚠️  To stop all APIs, press Ctrl+C or run:"
echo "   kill $ENHANCED_PID $MODERNIZED_PID $BACKEND_PID"
echo ""
echo "🧪 Test with Postman collection or visit URLs above"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping all APIs..."
    kill $ENHANCED_PID $MODERNIZED_PID $BACKEND_PID 2>/dev/null
    echo "✅ All APIs stopped"
    exit 0
}

# Trap Ctrl+C and cleanup
trap cleanup SIGINT

# Keep script running
echo "👀 Monitoring APIs... Press Ctrl+C to stop all"
wait
