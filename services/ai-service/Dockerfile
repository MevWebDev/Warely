# services/ai-service/Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gcc \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies with verbose output for debugging
RUN pip install --no-cache-dir --verbose -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash aiuser && \
    chown -R aiuser:aiuser /app
USER aiuser

# Expose port
EXPOSE 6000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:6000/health || exit 1

# Start the application
CMD ["python", "-m", "app.main"]