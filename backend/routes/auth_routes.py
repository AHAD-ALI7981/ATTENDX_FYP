from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import LoginRequest, ForgotPasswordRequest, ResetPasswordRequest
from auth import (
    verify_password, create_access_token, get_current_user, EXPIRE_HOURS,
    hash_password, create_password_reset_token, verify_password_reset_token
)
from email_utils import send_reset_email

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

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, req_obj: Request, db: Session = Depends(get_db)):
    """Generates a reset token and sends an email to the user."""
    user = db.query(User).filter(User.email == req.email).first()
    
    # We always return the same message to prevent email enumeration
    msg = "If your email is registered, you will receive a password reset link shortly."
    
    if user:
        token = create_password_reset_token(user.email)
        # Construct the reset link based on the request's origin/host
        base_url = str(req_obj.base_url).rstrip("/")
        reset_link = f"{base_url}/reset-password.html?token={token}"
        send_reset_email(user.email, reset_link)
        
    return {"message": msg}

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Validates the reset token and updates the user's password."""
    email = verify_password_reset_token(req.token)
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
        
    user.password_hash = hash_password(req.new_password)
    db.commit()
    
    return {"message": "Password has been successfully reset. You can now login."}
