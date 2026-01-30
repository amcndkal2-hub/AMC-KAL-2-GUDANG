/**
 * Auto-Redirect Handler for Old Deployment URLs
 * Detects if user is using old deployment URL and redirects to stable production URL
 */
(function() {
  // Stable production URL
  const STABLE_URL = 'https://amc-kal-2-gudang.pages.dev';
  
  // Current URL
  const currentUrl = window.location.href;
  const currentHostname = window.location.hostname;
  
  // Check if this is a deployment preview URL (has random ID prefix)
  // Format: https://[RANDOM-ID].amc-kal-2-gudang.pages.dev
  const isDeploymentPreview = currentHostname.match(/^[a-f0-9]{8}\.amc-kal-2-gudang\.pages\.dev$/i);
  
  if (isDeploymentPreview) {
    // Extract current path
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    const newUrl = STABLE_URL + currentPath;
    
    // Check if user already dismissed notification (session storage)
    const dismissed = sessionStorage.getItem('url-redirect-dismissed');
    
    if (!dismissed) {
      // Show notification banner
      showRedirectBanner(newUrl);
    }
  }
  
  function showRedirectBanner(newUrl) {
    // Create banner HTML
    const banner = document.createElement('div');
    banner.id = 'url-redirect-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideDown 0.3s ease-out;
    `;
    
    banner.innerHTML = `
      <style>
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        #url-redirect-banner button {
          transition: all 0.2s;
        }
        #url-redirect-banner button:hover {
          transform: scale(1.05);
        }
      </style>
      <i class="fas fa-info-circle" style="font-size: 24px;"></i>
      <div style="flex: 1; max-width: 600px;">
        <strong style="display: block; margin-bottom: 4px;">⚠️ URL Lama Terdeteksi</strong>
        <span style="font-size: 14px; opacity: 0.95;">
          Anda menggunakan URL deployment lama. Klik <strong>Update Sekarang</strong> untuk menggunakan URL stabil yang tidak berubah.
        </span>
      </div>
      <button 
        onclick="window.location.href='${newUrl}'" 
        style="
          background: white;
          color: #667eea;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
        🔄 Update Sekarang
      </button>
      <button 
        onclick="document.getElementById('url-redirect-banner').style.display='none'; sessionStorage.setItem('url-redirect-dismissed', 'true')" 
        style="
          background: transparent;
          color: white;
          border: 1px solid rgba(255,255,255,0.5);
          padding: 10px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        ">
        ✕ Nanti Saja
      </button>
    `;
    
    // Add to body
    document.body.appendChild(banner);
    
    // Add body padding to prevent content overlap
    document.body.style.paddingTop = '80px';
    
    // Auto redirect after 10 seconds (optional)
    setTimeout(() => {
      const bannerStillVisible = document.getElementById('url-redirect-banner');
      if (bannerStillVisible && bannerStillVisible.style.display !== 'none') {
        showCountdown(newUrl);
      }
    }, 10000);
  }
  
  function showCountdown(newUrl) {
    const banner = document.getElementById('url-redirect-banner');
    if (!banner) return;
    
    let countdown = 5;
    const interval = setInterval(() => {
      if (countdown <= 0) {
        clearInterval(interval);
        window.location.href = newUrl;
        return;
      }
      
      banner.innerHTML = `
        <i class="fas fa-sync fa-spin" style="font-size: 24px;"></i>
        <div style="flex: 1; text-align: center;">
          <strong style="display: block; font-size: 18px;">Auto-redirect dalam ${countdown} detik...</strong>
          <span style="font-size: 14px; opacity: 0.9;">Mengalihkan ke URL stabil</span>
        </div>
        <button 
          onclick="window.location.href='${newUrl}'" 
          style="
            background: white;
            color: #667eea;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
          ">
          Redirect Sekarang
        </button>
      `;
      
      countdown--;
    }, 1000);
  }
})();
