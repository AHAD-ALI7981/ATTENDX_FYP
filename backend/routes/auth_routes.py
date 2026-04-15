from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest
from auth import verify_password, create_access_token, get_current_user, EXPIRE_HOURS

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login")
def login(req: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Login and set a secure HttpOnly JWT cookie."""
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")

    token = create_access_token(user.username, user.role)
    
    # Crucial security step: Setting HttpOnly cookie!
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,  # JS cannot access this cookie (prevents XSS)
        samesite="lax", # CSRF protection
        secure=False,   # Set to True in production over HTTPS
        max_age=EXPIRE_HOURS * 3600
    )
    
    return {"message": "Login successful", "role": user.role}

@router.post("/logout")
def logout(response: Response):
    """Clear the HttpOnly authentication cookie."""
    response.delete_cookie(key="access_token")
    return {"message": "Logged out successfully"}

@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Return the username and role associated with the current cookie."""
    return {"username": user.get("sub"), "role": user.get("role")}
