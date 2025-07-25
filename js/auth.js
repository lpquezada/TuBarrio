// Authentication logic for DoorLoop clone
// This file handles user registration, login, and simple client‑side persistence

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');
  const showRegisterLink = document.getElementById('showRegister');
  const showLoginLink = document.getElementById('showLogin');
  const authMessage = document.getElementById('authMessage');

  // Toggle between login and registration views
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', event => {
      event.preventDefault();
      loginForm.classList.add('d-none');
      registerForm.classList.remove('d-none');
      authMessage.textContent = '';
    });
  }

  if (showLoginLink) {
    showLoginLink.addEventListener('click', event => {
      event.preventDefault();
      registerForm.classList.add('d-none');
      loginForm.classList.remove('d-none');
      authMessage.textContent = '';
    });
  }

  // Helper functions to work with localStorage
  function getUsers() {
    return JSON.parse(localStorage.getItem('users') || '[]');
  }

  function saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  }

  function setCurrentUser(id) {
    localStorage.setItem('currentUserId', id);
  }

  // Handle user registration
  if (registerBtn) {
    registerBtn.addEventListener('click', event => {
      event.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim().toLowerCase();
      const password = document.getElementById('regPassword').value;
      const role = document.getElementById('regRole').value;
      authMessage.textContent = '';
      
      if (!name || !email || !password) {
        authMessage.textContent = 'Please fill out all required fields.';
        return;
      }
      // Validate simple email format
      const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
      if (!emailRegex.test(email)) {
        authMessage.textContent = 'Please enter a valid email address.';
        return;
      }
      // Check if user already exists
      const users = getUsers();
      if (users.some(u => u.email === email)) {
        authMessage.textContent = 'An account with that email already exists.';
        return;
      }
      // Create user object; note: password stored in plain text for simulation
      const newUser = {
        id: Date.now(),
        name,
        email,
        password,
        role
      };
      users.push(newUser);
      saveUsers(users);
      setCurrentUser(newUser.id);
      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    });
  }

  // Handle user login
  if (loginBtn) {
    loginBtn.addEventListener('click', event => {
      event.preventDefault();
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;
      authMessage.textContent = '';
      if (!email || !password) {
        authMessage.textContent = 'Please enter your email and password.';
        return;
      }
      const users = getUsers();
      const user = users.find(u => u.email === email && u.password === password);
      if (!user) {
        authMessage.textContent = 'Invalid email or password.';
        return;
      }
      setCurrentUser(user.id);
      // Redirect to dashboard
      window.location.href = 'dashboard.html';
    });
  }
});