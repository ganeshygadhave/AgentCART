# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full backend app
COPY . .

# Run the seed script to pre-populate the database
RUN python reset_and_seed.py || python seed_demo_data.py || echo "Seed skipped"

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Start FastAPI with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
