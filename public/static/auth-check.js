// =============================================
// Authentication Check for Protected Pages
// =============================================

async function checkAuth() {
  const sessionToken = localStorage.getItem('sessionToken')
  
  if (!sessionToken) {
    redirectToLogin()
    return false
  }
  
  try {
    const response = await fetch('/api/check-session', {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    })
    
    const data = await response.json()
    
    if (!data.valid) {
      localStorage.removeItem('sessionToken')
      localStorage.removeItem('userRole')
      localStorage.removeItem('username')
      redirectToLogin()
      return false
    }
    
    // Store user role and username for UI control
    localStorage.setItem('userRole', data.role)
    localStorage.setItem('username', data.username)
    
    // Show/hide admin features based on role
    updateUIBasedOnRole(data.role)
    
    return true
  } catch (error) {
    console.error('Auth check error:', error)
    redirectToLogin()
    return false
  }
}

function updateUIBasedOnRole(role) {
  // Show delete buttons only for admin users
  const deleteButtons = document.querySelectorAll('.admin-only, .btn-delete')
  deleteButtons.forEach(btn => {
    if (role === 'admin') {
      btn.style.display = 'inline-block'
    } else {
      btn.style.display = 'none'
    }
  })
}

function isAdmin() {
  return localStorage.getItem('userRole') === 'admin'
}

function redirectToLogin() {
  window.location.href = '/login'
}

// Logout function
async function logout() {
  const sessionToken = localStorage.getItem('sessionToken')
  
  if (sessionToken) {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }
  
  localStorage.removeItem('sessionToken')
  localStorage.removeItem('userRole')
  localStorage.removeItem('username')
  window.location.href = '/login'
}

// Run auth check on page load
document.addEventListener('DOMContentLoaded', async function() {
  await checkAuth()
})
