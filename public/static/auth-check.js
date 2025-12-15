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
      redirectToLogin()
      return false
    }
    
    return true
  } catch (error) {
    console.error('Auth check error:', error)
    redirectToLogin()
    return false
  }
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
  window.location.href = '/login'
}

// Run auth check on page load
document.addEventListener('DOMContentLoaded', async function() {
  await checkAuth()
})
