// =============================================
// Check Input Manual Tab Permission
// Only user "Andalcekatan" can access "Input Manual" tab
// All users can access "Dari LH05" and "Input dari RAB" tabs
// =============================================

async function checkInputPermission() {
  // Wait a bit for auth-check.js to populate localStorage
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const sessionToken = localStorage.getItem('sessionToken')
  const username = localStorage.getItem('username')
  
  console.log('🔐 Checking Input Manual tab permission for:', username)
  
  if (!sessionToken || !username) {
    console.log('⏳ Waiting for auth-check.js to complete...')
    // Try again after a delay
    setTimeout(checkInputPermission, 500)
    return false
  }
  
  // Only "Andalcekatan" can access Input Manual tab
  const ALLOWED_USERS = ['Andalcekatan']
  
  if (!ALLOWED_USERS.includes(username)) {
    console.log('❌ User not allowed to access Input Manual tab:', username)
    restrictManualTab(username)
    return false
  }
  
  console.log('✅ User allowed to access Input Manual tab:', username)
  return true
}

function restrictManualTab(currentUser) {
  // Hide Input Manual tab button
  const manualTabButton = document.getElementById('tabManual')
  if (manualTabButton) {
    manualTabButton.style.display = 'none'
    console.log('🚫 Input Manual tab button hidden for:', currentUser)
  }
  
  // Hide Input Manual tab content (FIXED: correct ID)
  const manualTabContent = document.getElementById('contentManual')
  if (manualTabContent) {
    manualTabContent.style.display = 'none'
    console.log('🚫 Input Manual tab content hidden for:', currentUser)
  }
  
  // Switch to LH05 tab by default
  const lh05TabButton = document.getElementById('tabLH05')
  const lh05TabContent = document.getElementById('contentLH05')
  
  if (lh05TabButton && lh05TabContent) {
    // Hide manual tab first
    const manualTab = document.getElementById('contentManual')
    if (manualTab) {
      manualTab.classList.add('hidden')
    }
    
    // Activate LH05 tab
    lh05TabButton.classList.add('text-blue-600', 'border-b-2', 'border-blue-600')
    lh05TabButton.classList.remove('text-gray-500')
    lh05TabContent.classList.remove('hidden')
    
    console.log('✅ Switched to LH05 tab for:', currentUser)
  }
  
  // Show info banner about restricted access
  showInfoBanner(currentUser)
}

function showInfoBanner(currentUser) {
  const headerSection = document.querySelector('.bg-white.rounded-lg.shadow-md.p-6.mb-6')
  if (headerSection) {
    const bannerHTML = `
      <div class="mt-4 bg-blue-50 border-l-4 border-blue-500 rounded p-4">
        <div class="flex items-start">
          <i class="fas fa-info-circle text-blue-500 text-xl mr-3 mt-1"></i>
          <div class="flex-1">
            <p class="text-sm text-gray-700">
              <strong>Info:</strong> Tab <strong>"Input Manual"</strong> hanya tersedia untuk user <strong class="text-green-600">Andalcekatan</strong>.
            </p>
            <p class="text-xs text-gray-600 mt-1">
              User Anda (<strong class="text-blue-600">${currentUser}</strong>) dapat menggunakan tab <strong>"Dari LH05"</strong> dan <strong>"Input dari RAB"</strong>.
            </p>
          </div>
        </div>
      </div>
    `
    headerSection.insertAdjacentHTML('beforeend', bannerHTML)
  }
}

// Run check when page loads
window.addEventListener('DOMContentLoaded', () => {
  checkInputPermission()
})
