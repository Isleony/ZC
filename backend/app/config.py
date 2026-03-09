from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = Field(default="postgresql://crime:crime@db:5432/crimedb", alias="DATABASE_URL")


settings = Settings()
