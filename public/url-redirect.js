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
  
  console.log('🔍 URL Redirect Check:', {
    currentHostname,
    isDeploymentPreview: !!isDeploymentPreview,
    dismissed: sessionStorage.getItem('url-redirect-dismissed')
  });
  
  if (isDeploymentPreview) {
    // Extract current path
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    const newUrl = STABLE_URL + currentPath;
    
    // Check if user already dismissed notification (session storage)
    const dismissed = sessionStorage.getItem('url-redirect-dismissed');
    
    if (!dismissed) {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          showRedirectBanner(newUrl);
        });
      } else {
        // DOM already loaded
        showRedirectBanner(newUrl);
      }
    }
  }
  
  function showRedirectBanner(newUrl) {
    console.log('✅ Showing redirect banner:', newUrl);
    
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
      padding: 20px 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideDown 0.3s ease-out;
      flex-wrap: wrap;
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
      <div style="font-size: 32px; line-height: 1;">⚠️</div>
      <div style="flex: 1; max-width: 600px;">
        <strong style="display: block; margin-bottom: 4px; font-size: 16px;">URL Lama Terdeteksi</strong>
        <span style="font-size: 13px; opacity: 0.95; line-height: 1.4;">
          Anda menggunakan URL deployment lama. Klik <strong>Update Sekarang</strong> untuk menggunakan URL stabil yang tidak berubah.
        </span>
      </div>
      <button 
        onclick="window.location.href='${newUrl}'" 
        style="
          background: white;
          color: #667eea;
          border: none;
          padding: 12px 24px;
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
          padding: 12px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
        ">
        ✕ Nanti Saja
      </button>
    `;
    
    // Add to body
    document.body.insertBefore(banner, document.body.firstChild);
    
    // Add body padding to prevent content overlap
    document.body.style.paddingTop = '100px';
    
    console.log('✅ Banner added to DOM with padding-top: 100px');
    
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
        <div style="font-size: 32px; line-height: 1;">🔄</div>
        <div style="flex: 1; text-align: center;">
          <strong style="display: block; font-size: 18px; margin-bottom: 4px;">Auto-redirect dalam ${countdown} detik...</strong>
          <span style="font-size: 14px; opacity: 0.9;">Mengalihkan ke URL stabil</span>
        </div>
        <button 
          onclick="window.location.href='${newUrl}'" 
          style="
            background: white;
            color: #667eea;
            border: none;
            padding: 12px 24px;
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
