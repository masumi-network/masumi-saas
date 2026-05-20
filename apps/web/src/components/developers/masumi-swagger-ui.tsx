"use client";

/**
 * Swagger UI shared with masumi-payment-service:
 *  - same `swagger-custom.css` theme
 *  - same JS behaviour (enhanced filter, clear button, ⌘/Ctrl+K shortcut,
 *    hidden topbar branding)
 *  - same Swagger options (agate syntax theme, no validator, list expansion)
 *
 * Payment-service injects this as `customJsStr` via swagger-ui-express. Here
 * we run the equivalent DOM-manipulation in a React `useEffect`, polling for
 * Swagger's elements because `swagger-ui-react` renders lazily.
 */

import "swagger-ui-react/swagger-ui.css";
import "@/../public/swagger-custom.css";

import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { useEffect } from "react";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

type MasumiSwaggerUiProps = {
  specUrl: string;
};

const FILTER_PLACEHOLDER = "Filter by tag, endpoint, or description...";
const FILTER_DEBOUNCE_MS = 150;
const POLL_INTERVAL_MS = 300;

export function MasumiSwaggerUi({ specUrl }: MasumiSwaggerUiProps) {
  const { resolvedTheme } = useTheme();

  /** `swagger-custom.css` reads `:root[data-theme]` for light/dark. */
  useEffect(() => {
    if (!resolvedTheme) return;
    const el = document.documentElement;
    el.setAttribute("data-theme", resolvedTheme === "dark" ? "dark" : "light");
    return () => {
      el.removeAttribute("data-theme");
    };
  }, [resolvedTheme]);

  /**
   * DOM enhancements that mirror payment-service's `customJsStr`. Runs on
   * mount, sets up its own teardown. Each enhancement polls for the element
   * it needs because SwaggerUI is rendered async after dynamic-import.
   */
  useEffect(() => {
    const teardown: Array<() => void> = [];
    let cancelled = false;

    // 1. Hide the default Swagger branding text inside the topbar link.
    {
      let attempts = 0;
      const hideTopbarBranding = () => {
        if (cancelled) return;
        const topbarLink = document.querySelector<HTMLElement>(
          ".topbar-wrapper .link",
        );
        if (topbarLink) {
          topbarLink.style.display = "none";
          return;
        }
        if (attempts++ < 20) {
          window.setTimeout(hideTopbarBranding, POLL_INTERVAL_MS);
        }
      };
      hideTopbarBranding();
    }

    // 2. ⌘/Ctrl+K focuses the filter input.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key !== "k") return;
      const filterInput = document.querySelector<HTMLInputElement>(
        ".operation-filter-input",
      );
      if (!filterInput) return;
      event.preventDefault();
      filterInput.focus();
      filterInput.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    document.addEventListener("keydown", onKeyDown);
    teardown.push(() => document.removeEventListener("keydown", onKeyDown));

    // 3. Enhanced filter: match tag, path, method, or description. Wrap the
    // input with a clear (×) button. Strip Swagger's built-in event handler
    // by cloning the input.
    {
      let attempts = 0;
      let debounce: number | undefined;

      const applyFilter = (input: HTMLInputElement) => {
        const query = input.value.toLowerCase().trim();
        const sections = document.querySelectorAll<HTMLElement>(
          ".opblock-tag-section",
        );
        sections.forEach((section) => {
          if (!query) {
            section.style.display = "";
            section
              .querySelectorAll<HTMLElement>(".opblock")
              .forEach((op) => (op.style.display = ""));
            return;
          }
          const tagText =
            section.querySelector(".opblock-tag")?.textContent ?? "";
          const tagMatch = tagText.toLowerCase().includes(query);
          let anyOpMatch = false;
          section.querySelectorAll<HTMLElement>(".opblock").forEach((op) => {
            const path =
              op.querySelector(".opblock-summary-path")?.textContent ?? "";
            const desc =
              op.querySelector(".opblock-summary-description")?.textContent ??
              "";
            const method =
              op.querySelector(".opblock-summary-method")?.textContent ?? "";
            const match =
              path.toLowerCase().includes(query) ||
              method.toLowerCase().includes(query) ||
              tagMatch ||
              desc.toLowerCase().includes(query);
            op.style.display = match ? "" : "none";
            if (match) anyOpMatch = true;
          });
          section.style.display = tagMatch || anyOpMatch ? "" : "none";
        });
      };

      const wireFilter = () => {
        if (cancelled) return;
        const original = document.querySelector<HTMLInputElement>(
          ".operation-filter-input",
        );
        if (!original) {
          if (attempts++ < 60) {
            window.setTimeout(wireFilter, POLL_INTERVAL_MS);
          }
          return;
        }
        if (original.dataset.masumiEnhanced === "1") return;

        original.setAttribute("placeholder", FILTER_PLACEHOLDER);

        // Clone to strip Swagger's React-bound listeners.
        const input = original.cloneNode(true) as HTMLInputElement;
        input.dataset.masumiEnhanced = "1";
        const parent = original.parentNode;
        if (!parent) return;
        parent.replaceChild(input, original);

        const wrapper = document.createElement("div");
        wrapper.className = "filter-wrapper";
        input.parentNode?.insertBefore(wrapper, input);
        wrapper.appendChild(input);

        const clearBtn = document.createElement("button");
        clearBtn.className = "filter-clear-btn";
        clearBtn.type = "button";
        clearBtn.innerHTML = "&times;";
        clearBtn.title = "Clear filter";
        clearBtn.style.display = "none";
        wrapper.appendChild(clearBtn);

        const updateClearBtnVisibility = () => {
          clearBtn.style.display = input.value ? "" : "none";
        };
        const onInput = () => {
          updateClearBtnVisibility();
          window.clearTimeout(debounce);
          debounce = window.setTimeout(
            () => applyFilter(input),
            FILTER_DEBOUNCE_MS,
          );
        };
        const onClear = () => {
          input.value = "";
          updateClearBtnVisibility();
          applyFilter(input);
          input.focus();
        };
        input.addEventListener("input", onInput);
        clearBtn.addEventListener("click", onClear);
        teardown.push(() => {
          input.removeEventListener("input", onInput);
          clearBtn.removeEventListener("click", onClear);
          window.clearTimeout(debounce);
        });
      };

      wireFilter();
    }

    return () => {
      cancelled = true;
      for (const fn of teardown) {
        try {
          fn();
        } catch {
          // best-effort teardown; ignore.
        }
      }
    };
  }, []);

  return (
    <SwaggerUI
      url={specUrl}
      docExpansion="list"
      defaultModelsExpandDepth={0}
      deepLinking
      filter
      persistAuthorization
      tryItOutEnabled
      displayRequestDuration
      // `validatorUrl` + `syntaxHighlight` are valid swagger-ui-dist options
      // (also used by masumi-payment-service) but not in the `swagger-ui-react`
      // typed props. Pass them via spread so the underlying setup picks them up.
      {...({
        validatorUrl: "none",
        syntaxHighlight: { activate: true, theme: "agate" },
      } as Record<string, unknown>)}
    />
  );
}
