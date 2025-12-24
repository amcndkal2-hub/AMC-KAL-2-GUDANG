// =============================================
// Authentication Check for Protected Pages
// With Auto-Logout after 10 minutes inactivity
// =============================================

let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

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
    
    // Start inactivity timer
    startInactivityTimer()
    
    return true
  } catch (error) {
    console.error('Auth check error:', error)
    redirectToLogin()
    return false
  }
}

function startInactivityTimer() {
  // Clear existing timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer)
  }
  
  // Set new timer
  inactivityTimer = setTimeout(() => {
    console.log('⏰ Auto-logout: 10 minutes inactivity')
    alert('⏰ Sesi Anda telah berakhir karena tidak ada aktivitas selama 10 menit.\n\nSilakan login kembali.')
    logout()
  }, INACTIVITY_TIMEOUT)
}

function resetInactivityTimer() {
  startInactivityTimer()
}

// Track user activity
const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']

activityEvents.forEach(event => {
  document.addEventListener(event, resetInactivityTimer, true)
})

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
  
  // Clear inactivity timer
  if (inactivityTimer) {
    clearTimeout(inactivityTimer)
  }
  
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
