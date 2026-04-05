export default {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
                "outline-variant": "#424754",
                "surface-container-highest": "#333539",
                "primary": "#adc6ff",
                "tertiary-container": "#a078ff",
                "on-surface": "#e2e2e8",
                "surface-container-high": "#282a2e",
                "on-surface-variant": "#c2c6d6",
                "surface": "#111318",
                "surface-variant": "#333539",
                "on-primary-fixed": "#001a42",
                "tertiary-fixed-dim": "#d0bcff",
                "outline": "#8c909f",
                "primary-fixed": "#d8e2ff",
                "on-error": "#690005",
                "background": "#111318",
                "inverse-on-surface": "#2f3035",
                "on-tertiary-fixed": "#23005c",
                "on-primary-container": "#00285d",
                "inverse-primary": "#005ac2",
                "secondary": "#c0c1ff",
                "on-background": "#e2e2e8",
                "on-tertiary": "#3c0091",
                "surface-dim": "#111318",
                "secondary-fixed-dim": "#c0c1ff",
                "on-tertiary-fixed-variant": "#5516be",
                "on-primary-fixed-variant": "#004395",
                "on-primary": "#002e6a",
                "on-secondary-fixed-variant": "#2f2ebe",
                "on-secondary-fixed": "#07006c",
                "on-secondary-container": "#b0b2ff",
                "surface-container-lowest": "#0c0e12",
                "surface-bright": "#37393e",
                "on-error-container": "#ffdad6",
                "secondary-container": "#3131c0",
                "tertiary": "#d0bcff",
                "on-tertiary-container": "#340080",
                "surface-tint": "#adc6ff",
                "error-container": "#93000a",
                "inverse-surface": "#e2e2e8",
                "tertiary-fixed": "#e9ddff",
                "error": "#ffb4ab",
                "on-secondary": "#1000a9",
                "surface-container-low": "#1a1c20",
                "primary-fixed-dim": "#adc6ff",
                "primary-container": "#4d8eff",
                "surface-container": "#1e2024",
                "secondary-fixed": "#e1e0ff"
        },
        "borderRadius": {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
        },
        "fontFamily": {
                "headline": ["Manrope", "sans-serif"],
                "body": ["Inter", "sans-serif"],
                "label": ["Inter", "sans-serif"]
        }
      },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries')
    ]
  }
