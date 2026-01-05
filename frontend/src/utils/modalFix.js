// Utility to prevent stuck modals
// Run this in console if modals get stuck: window.closeAllModals()

window.closeAllModals = function() {
    // Remove all modal overlays
    document.querySelectorAll('.modal-overlay').forEach(el => {
        el.style.display = 'none';
        el.remove();
    });
    
    // Also try to remove any other potential blocking overlays
    document.querySelectorAll('[class*="overlay"]').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' && style.zIndex > 999) {
            el.style.display = 'none';
        }
    });
    
    console.log('All modals closed');
};

