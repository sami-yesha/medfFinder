/**
 * MedFinder - Internationalization (i18n) Service
 * Handles language detection, loading locales, and DOM translation.
 */

const i18n = {
  currentLang: localStorage.getItem('medfinder_lang') || 'en',
  translations: {},

  /**
   * Initialize i18n: Load translations and apply to DOM
   */
  async init() {
    await this.loadTranslations(this.currentLang);
    this.applyTranslations();
    this.updateLanguageSwitcherUI();
    
    // Set HTML lang attribute
    document.documentElement.setAttribute('lang', this.currentLang);
  },

  /**
   * Load translation file for a given language
   */
  async loadTranslations(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Could not load ${lang} translations`);
      this.translations = await response.json();
      this.currentLang = lang;
      localStorage.setItem('medfinder_lang', lang);
    } catch (error) {
      console.error('i18n Load Error:', error);
      // Fallback to English if loading fails
      if (lang !== 'en') await this.loadTranslations('en');
    }
  },

  /**
   * Get translation for a specific key
   * Supports nested keys (e.g., "nav.home") and variables (e.g., "{{count}}")
   */
  t(key, variables = {}) {
    let value = key.split('.').reduce((obj, k) => obj?.[k], this.translations);
    
    if (!value) {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }

    // Replace variables
    Object.keys(variables).forEach(v => {
      value = value.replace(`{{${v}}}`, variables[v]);
    });

    return value;
  },

  /**
   * Apply translations to all elements with data-i18n attribute
   */
  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translation;
      } else {
        // Use innerHTML to support <br> tags in translations (e.g., hero title)
        el.innerHTML = translation;
      }
    });

    // Update dynamic attributes like aria-label if needed
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', this.t(key));
    });
  },

  /**
   * Switch language and reload page or update DOM
   */
  async switchLanguage(lang) {
    if (lang === this.currentLang) return;
    await this.loadTranslations(lang);
    this.applyTranslations();
    this.updateLanguageSwitcherUI();
    document.documentElement.setAttribute('lang', lang);
    
    // Dispatch event for other scripts to respond
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
  },

  /**
   * Update the UI state of the language switcher
   */
  updateLanguageSwitcherUI() {
    const switcher = document.getElementById('language-switcher');
    if (switcher) {
      switcher.value = this.currentLang;
    }
    
    // Handle Amharic specific styling (font changes if needed)
    if (this.currentLang === 'am') {
      document.body.classList.add('lang-am');
    } else {
      document.body.classList.remove('lang-am');
    }
  }
};

// Global export
window.i18n = i18n;
