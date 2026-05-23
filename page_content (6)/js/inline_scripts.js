
    window.bubble_session_uid = '1779241103992x350321288163453630';



    window.headers_source_maps = [["plugin_main_headers_1580238841425x582072028873097200",214,245],["plugin_main_headers_1658328157117x953686184769617900",246,248],["plugin_main_headers_1680110374647x249108010620944400",249,380],["plugin_main_headers_1687446439843x865924681433350100",381,388],["custom_app_header",390,643]]



function make_proxy(target, name) {
  return new Proxy(target, {
    get: function(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      throw new Error('The variable ' + name + ' is not fully initialized yet');
    }
  });
}
window.appquery = make_proxy({
  app_version: function() { return "live"; },
  last_change: function() { return "56965762381";},
}, 'appquery');
window.Lib = new Proxy(function() {}, {
  get: function(target, prop) {
    if (prop === 'is_skeleton') {
      return true;
    }
    throw new Error('The variable ' + Lib + ' is not fully initialized yet');
  },
  apply: function() {
    return make_proxy({
      current_user: function() {
        return make_proxy({ id: "1779241103992x350321288163453630" }, 'Lib().current_user');
      }
    }, 'Lib()');
  }
});



function load_error_function (event) {
  return window.load_error_log.push({ msg: event.message, error_url: event.filename, line: event.lineno, col: event.colno })
}
window.load_error_log = [];
window.addEventListener('error', load_error_function);
window.disableLoadErrorFunction = function () {
  window.removeEventListener('error', load_error_function);
}



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['pre_early_js'] = Date.now();



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['post_early_js'] = Date.now();


(function () {
    function onWebFontFinish () {
        window.google_web_fonts_active = true;
if (window.google_web_fonts_active_cb) {
    window.google_web_fonts_active_cb();
}
        (function fontface_loaded_snippet (font) {
  if (window.fontface_loaded == null) {
    window.fontface_loaded = {}
  }
  if (font != null) {
    window.fontface_loaded[font] = true
  } else {
    window.all_fontface_loaded = true
  }
  if (window.fontface_webfonts_loaded_cb) {
    return window.fontface_webfonts_loaded_cb(font)
  }
})()
    }
    const WebFontConfig = {'google': { families: ["Poppins:300","Poppins:regular","Poppins:500","Poppins:600","Poppins:700"] },
        active: function() {
            onWebFontFinish()
        },
        inactive: function() {
            console.log('Failed to load all the fonts');
            onWebFontFinish()
        },
        fontinactive: function(family_name, fvd) {
            console.log('fontinactive being called for ' + family_name + ', Google says the fonts didnt render');
            onWebFontFinish()
        }
    }
        window.WebFont.load(WebFontConfig);
})();


(function initialize_data() {
const xhr = new XMLHttpRequest();
xhr.onreadystatechange = function() {
    if (this.readyState === 4 && this.status === 200) {
        const data = JSON.parse(this.responseText);

        function init_data() {
            data.forEach(function(d) {
                Lib().db_instance().initialize_data(d.id, d.data, d.type, d.version);
            })
        }

        if (window.Lib && window.Lib.is_skeleton == null) {
            init_data();
        } else {
            window.Lib_post_load = init_data;
        }
    }
};
xhr.open("GET", "https://dudafarage.com.br/api/1.1/init/data?location=" + encodeURIComponent(window.location.href), true);
xhr.send();
})();


window.gm_key = "AIzaSyAlT1MzDJL1hTzjgn_-PbAD3NQEIKjcJi4";

window.glrl_key_status = false;

window.bubble_page_load_id = "1779241104696x240";

window.bubble_plp_token = "NwqcLTBV8zeK3VnWn3HgpdiNe0vlRfWouRaWtCs8X6w=";

window.bubble_is_leanjs = false;

window.bubble_shim_modules = false;

window._p = '{"id":"app_starter_2023","no_branding":true,"import_export_csv":true,"custom_domain":true}';

window.bubble_page_name = "lp";

window.__bubble_module_mode = false;


if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['pre_run_js'] = Date.now();



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['post_run_js'] = Date.now();



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['pre_static_js'] = Date.now();



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['post_static_js'] = Date.now();



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['pre_dynamic_js'] = Date.now();



if (!window._bubble_page_load_data) {
  window._bubble_page_load_data = {}
}
if (!window._bubble_page_load_data.js_execution_timings) {
  window._bubble_page_load_data.js_execution_timings = {}
}
window._bubble_page_load_data.js_execution_timings['post_dynamic_js'] = Date.now();


window._bubble_page_load_data.js_execution_timings.plugin_js_start_execution = Date.now();


    const overrideFlag = "".toLowerCase();
    const overrideDefaultCheckbox = ["true", "yes", "enabled"].includes(overrideFlag);
    if (overrideDefaultCheckbox) {
        const styleEl = document.getElementById("override-default-checkbox");
        if(styleEl.hasAttribute('media')) {
            styleEl.removeAttribute('media');
        }
    }


window.ncgSupabaseURL = "https://siinnffsfjvkjdaiwdla.supabase.co";

window.ncgSupabaseAPIKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpaW5uZmZzZmp2a2pkYWl3ZGxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MTI3NjksImV4cCI6MjA4MzI4ODc2OX0.B_dR5AljmvGO8QAMp0VBALrM1p2RlsCFU3RIxEQkCeI";

window.ncgSupabaseLogLevel = "";

window.ncgSupabasePublishableKey = "";

window._bubble_page_load_data.js_execution_timings.plugin_js_end_execution = Date.now();


(function () {

  function applyFarageDesign() {
    const el = document.querySelector(".bad-revision");
    if (!el) return;

    if (el.querySelector(".farage-content")) return;

    el.innerHTML = `
      <div class="farage-content">

        <div class="farage-left">
          <div class="farage-icon">⟳</div>

          <div class="farage-text">
            <strong>Nova versão disponível</strong>
            <span>Atualize para continuar com a melhor experiência.</span>
          </div>
        </div>

        <div class="farage-actions">
          <button class="farage-btn-primary" id="farage-reload">
            Atualizar
          </button>
          <button class="farage-btn-close" id="farage-close">
            ✕
          </button>
        </div>

      </div>
    `;

    document.getElementById("farage-reload").onclick = () => {
      location.reload();
    };

    document.getElementById("farage-close").onclick = () => {
      el.style.display = "none";
    };
  }

  const interval = setInterval(() => {
    const el = document.querySelector(".bad-revision");

    if (el) {
      applyFarageDesign();

      if (el.querySelector(".farage-content")) {
        clearInterval(interval);
      }
    }
  }, 300);

})();



(function () {

  function fixBubbleBlur() {
    try {
      const doc = window.parent.document;
      const body = doc.body;
      const html = doc.documentElement;

      /* Corrige halo branco */
      body.style.background = '#0E0E0E';
      html.style.background = '#0E0E0E';

      body.style.boxShadow = 'none';
      body.style.outline = 'none';
      body.style.border = 'none';

      body.style.transform = 'none';
    } catch (e) {
      console.warn('Erro ao ajustar blur do Bubble', e);
    }
  }

  /* Executa ao carregar */
  setTimeout(fixBubbleBlur, 200);

  /* Observa abertura do popup */
  const observer = new MutationObserver(() => {
    fixBubbleBlur();
  });

  observer.observe(window.parent.document.body, {
    childList: true,
    subtree: true
  });

})();



window.addEventListener('DOMContentLoaded', function () {
  if (window.appquery == null) {
    (function() {
    const html = `
      <div class="error-card">
        <div class="error-section">
          <div class="error-title">Your browser was unable to load some necessary resources</div>
          <div class="error-message">Contact your IT network administrator to allow access to:
    • d3dqmih97rcqmh.cloudfront.net
    • b2d9544af28488c3f94ed54fa05d9e46.cdn.bubble.io/
    • d1muf25xaso8hp.cloudfront.net</div>
        </div>
      </div>
    `

    const css = document.createElement('style')
    css.type = 'text/css'
    css.appendChild(
      document.createTextNode(`
      .error-overlay {
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.30);
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        position: fixed;
        inset: 0;
        z-index: 999999;
      }

      .error-card {
        width: 500px;
        margin: 40px;
        background: white;
        box-shadow: 0px 1px 2px rgba(0,0,0,0.10);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
      }

      .error-section {
        padding: 40px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .error-title {
        color: #1A1A1A;
        font-size: 18px;
        font-family: Arial, sans-serif;
        font-weight: 600;
        line-height: 28px;
      }

      .error-message {
        color: #525252;
        font-size: 14px;
        font-family: Arial, sans-serif;
        font-weight: 400;
        line-height: 20px;
        white-space: pre-wrap;
      }
    `)
    )
    document.head.appendChild(css)

    const container = document.createElement('div')
    container.className = 'error-overlay'
    container.innerHTML = html
    document.body.appendChild(container)
  })()
    httpRequest = new XMLHttpRequest();
httpRequest.open('POST', '/user/m', true);
httpRequest.setRequestHeader('Content-Type', 'application/json');
httpRequest.send(JSON.stringify({measures: {page_load_error: 1, url: document.location.href, errors: window.load_error_log}}));
  };
});


window.addEventListener('DOMContentLoaded', function () {if (window.appquery && window.app == null) {(function() {
    const html = `
      <div class="error-card">
        <div class="error-section">
          <div class="error-title">Your browser was unable to load the application</div>
          <div class="error-message">We&#39;ve been notified of the issue. Please try again in a few moments and make sure not to use ad-blockers.</div>
        </div>
      </div>
    `

    const css = document.createElement('style')
    css.type = 'text/css'
    css.appendChild(
      document.createTextNode(`
      .error-overlay {
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.30);
        overflow: hidden;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        position: fixed;
        inset: 0;
        z-index: 999999;
      }

      .error-card {
        width: 500px;
        margin: 40px;
        background: white;
        box-shadow: 0px 1px 2px rgba(0,0,0,0.10);
        border-radius: 8px;
        display: flex;
        flex-direction: column;
      }

      .error-section {
        padding: 40px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .error-title {
        color: #1A1A1A;
        font-size: 18px;
        font-family: Arial, sans-serif;
        font-weight: 600;
        line-height: 28px;
      }

      .error-message {
        color: #525252;
        font-size: 14px;
        font-family: Arial, sans-serif;
        font-weight: 400;
        line-height: 20px;
        white-space: pre-wrap;
      }
    `)
    )
    document.head.appendChild(css)

    const container = document.createElement('div')
    container.className = 'error-overlay'
    container.innerHTML = html
    document.body.appendChild(container)
  })()}});


!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '704810239337097');
fbq('track', 'PageView');



(function () {

  const INPUT_ID = 'telefone_input';

  function maskPhone(value) {
    value = value.replace(/\D/g, '').slice(0, 11);

    if (value.length > 10) {
      return value.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    }

    if (value.length > 6) {
      return value.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
    }

    if (value.length > 2) {
      return value.replace(/^(\d{2})(\d+)/, '($1) $2');
    }

    if (value.length > 0) {
      return value.replace(/^(\d+)/, '($1');
    }

    return value;
  }

  function applyMaskToInput(input) {
    if (input.dataset.maskApplied) return;
    input.dataset.maskApplied = 'true';

    input.addEventListener('input', function () {
      const start = input.selectionStart;
      const oldLength = input.value.length;

      input.value = maskPhone(input.value);

      const newLength = input.value.length;
      const diff = newLength - oldLength;

      input.setSelectionRange(start + diff, start + diff);
    });
  }

  function tryAttachMask() {
    const input = window.parent.document.getElementById(INPUT_ID);
    if (input) {
      applyMaskToInput(input);
      return true;
    }
    return false;
  }

  // Tenta imediatamente
  if (tryAttachMask()) return;

  // Observa o DOM do Bubble até o input aparecer
  const observer = new MutationObserver(() => {
    if (tryAttachMask()) {
      observer.disconnect();
    }
  });

  observer.observe(window.parent.document.body, {
    childList: true,
    subtree: true
  });

})();
