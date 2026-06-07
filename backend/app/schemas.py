import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

Mode = Literal["online", "offline"]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# -- auth ------------------------------------------------------------------- #
class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def _valid_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Invalid email address")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    plan: str
    credits: int


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# -- upload ----------------------------------------------------------------- #
class UploadResponse(BaseModel):
    file_id: int
    filename: str
    status: str
    chunks: int
    char_count: int
    text_preview: str


# -- chat ------------------------------------------------------------------- #
class ChatRequest(BaseModel):
    question: str
    file_id: Optional[int] = None
    mode: Mode = "offline"


class SourceChunk(BaseModel):
    text: str
    page: Optional[int] = None
    source: str
    score: float


class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    chunks: List[SourceChunk]
    used_ai: bool
    credits: int


# -- study tools ------------------------------------------------------------ #
class SummarizeRequest(BaseModel):
    file_id: Optional[int] = None
    mode: Mode = "offline"


class QuizRequest(BaseModel):
    topic: str = ""
    count: int = 5
    file_id: Optional[int] = None
    mode: Mode = "offline"


class PaperRequest(BaseModel):
    subject: str = ""
    level: str = "university"
    file_id: Optional[int] = None
    mode: Mode = "offline"


class PlanRequest(BaseModel):
    days: int = 7
    subject: str = ""
    file_id: Optional[int] = None
    mode: Mode = "offline"


class AnalyzeRequest(BaseModel):
    file_id: Optional[int] = None
    mode: Mode = "offline"


# -- payments --------------------------------------------------------------- #
class CreateOrderRequest(BaseModel):
    plan: str


class VerifyPaymentRequest(BaseModel):
    plan: str
    order_id: str
    payment_id: str = ""
    signature: str = ""
