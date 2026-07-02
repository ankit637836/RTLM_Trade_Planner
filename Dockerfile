# Use the official Python slim image for a smaller footprint
FROM python:3.12-slim

# Set the working directory
WORKDIR /app

# Install system dependencies required for psycopg2 (PostgreSQL)
RUN apt-get update && apt-get install -y \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual application code into the container
# We copy src and config directories
COPY src/ /app/src/
COPY config/ /app/config/

# Expose the port the FastAPI app will run on
EXPOSE 8000

# Start the application using Uvicorn
CMD ["uvicorn", "src.services.APIService:app", "--host", "0.0.0.0", "--port", "8000"]
