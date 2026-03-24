"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    picture: Mapped[str | None] = mapped_column(String(500))
    google_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="technician")  # admin, manager, technician
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    forms: Mapped[list["Form"]] = relationship(back_populates="created_by_user")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="submitted_by_user")


class Form(Base):
    __tablename__ = "forms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    schema: Mapped[dict] = mapped_column(JSONB, nullable=False)  # Full form structure
    sheets_id: Mapped[str | None] = mapped_column(String(255))  # Linked Google Sheet ID
    sheets_url: Mapped[str | None] = mapped_column(String(500))
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    created_by_user: Mapped["User"] = relationship(back_populates="forms")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="form", cascade="all, delete-orphan")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("forms.id"), index=True)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)  # All field responses
    gps_lat: Mapped[float | None] = mapped_column(Numeric(10, 7))
    gps_lng: Mapped[float | None] = mapped_column(Numeric(10, 7))
    submitted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    synced_to_sheets: Mapped[bool] = mapped_column(Boolean, default=False)

    # Offline sync support
    client_id: Mapped[str | None] = mapped_column(String(255))  # UUID generated on device
    offline_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    form: Mapped["Form"] = relationship(back_populates="submissions")
    submitted_by_user: Mapped["User"] = relationship(back_populates="submissions")
    media: Mapped[list["Media"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class Media(Base):
    __tablename__ = "media"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("submissions.id"), index=True)
    field_key: Mapped[str] = mapped_column(String(255), nullable=False)
    gcs_url: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int | None] = mapped_column()
    
    # 🟢 CAMBIO AQUÍ: Cambiamos 'metadata' por 'file_metadata'
    file_metadata: Mapped[dict | None] = mapped_column(JSONB)  # GPS coords, timestamp, etc.
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    submission: Mapped["Submission"] = relationship(back_populates="media")
