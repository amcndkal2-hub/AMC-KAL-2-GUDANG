// =============================================
// Check Input Manual Permission
// Only user "Andalcekatan" can access Input Manual
// =============================================

async function checkInputPermission() {
  // Wait a bit for auth-check.js to populate localStorage
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const sessionToken = localStorage.getItem('sessionToken')
  const username = localStorage.getItem('username')
  
  console.log('🔐 Checking Input Manual permission for:', username)
  
  if (!sessionToken || !username) {
    console.log('⏳ Waiting for auth-check.js to complete...')
    // Try again after a delay
    setTimeout(checkInputPermission, 500)
    return false
  }
  
  // Only "Andalcekatan" can access Input Manual
  const ALLOWED_USERS = ['Andalcekatan']
  
  if (!ALLOWED_USERS.includes(username)) {
    console.log('❌ User not allowed to access Input Manual:', username)
    showAccessDenied(username)
    return false
  }
  
  console.log('✅ User allowed to access Input Manual:', username)
  return true
}

function showAccessDenied(currentUser) {
  // Hide the form content
  const formContent = document.getElementById('inputFormContent')
  if (formContent) {
    formContent.style.display = 'none'
  }
  
  // Show access denied message
  const container = document.querySelector('.min-h-screen.py-8')
  if (container) {
    const deniedHTML = `
      <div class="max-w-2xl mx-auto mt-20">
        <div class="bg-red-50 border-l-4 border-red-500 rounded-lg shadow-lg p-8">
          <div class="flex items-center mb-4">
            <i class="fas fa-exclamation-triangle text-red-500 text-4xl mr-4"></i>
            <div>
              <h2 class="text-2xl font-bold text-red-800">Akses Ditolak</h2>
              <p class="text-red-600 mt-1">Access Denied</p>
            </div>
          </div>
          
          <div class="mt-6 p-4 bg-white rounded border border-red-200">
            <p class="text-gray-700 mb-4">
              <i class="fas fa-info-circle text-blue-500 mr-2"></i>
              Halaman <strong>Input Manual</strong> hanya dapat diakses oleh:
            </p>
            <ul class="list-disc list-inside ml-4 mb-4 text-gray-700">
              <li class="mb-2">Username: <strong class="text-green-600">Andalcekatan</strong></li>
            </ul>
            <hr class="my-4 border-gray-200">
            <p class="text-gray-600 text-sm">
              <i class="fas fa-user text-gray-400 mr-2"></i>
              User Anda saat ini: <strong class="text-blue-600">${currentUser || 'Unknown'}</strong>
            </p>
            <p class="text-gray-500 text-xs mt-2">
              Jika Anda memerlukan akses, silakan hubungi administrator sistem.
            </p>
          </div>
          
          <div class="mt-6 flex space-x-4">
            <a href="/dashboard/analytics" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-center font-semibold">
              <i class="fas fa-tachometer-alt mr-2"></i>Dashboard Analytics
            </a>
            <a href="/dashboard/stok" class="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg text-center font-semibold">
              <i class="fas fa-chart-bar mr-2"></i>Dashboard Stok
            </a>
          </div>
          
          <div class="mt-4">
            <button onclick="logout()" class="w-full bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold">
              <i class="fas fa-sign-out-alt mr-2"></i>Logout
            </button>
          </div>
        </div>
      </div>
    `
    
    container.innerHTML = deniedHTML
  }
}

// Run check when page loads
window.addEventListener('DOMContentLoaded', () => {
  checkInputPermission()
})
