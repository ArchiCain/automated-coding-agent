FROM pgvector/pgvector:pg16

# Set environment variables with default values
ENV POSTGRES_DB={{DATABASE_NAME}} \
    POSTGRES_USER={{MASTER_USERNAME}} \
    POSTGRES_PASSWORD={{MASTER_USERNAME}}

# Expose the PostgreSQL port
EXPOSE 5432

# The base image already includes CMD ["postgres"]
