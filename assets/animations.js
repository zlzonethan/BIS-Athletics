(function initBISAnimations() {
	if (window.__bisAnimationsInitialized) return;
	window.__bisAnimationsInitialized = true;

	const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const root = document.documentElement;
	const styleId = 'bis-animations-style';
	let revealObserver = null;
	let mutationObserver = null;
	let scanFrame = 0;

	const animationCss = `
		:root {
			--bis-motion-ease: cubic-bezier(0.22, 1, 0.36, 1);
		}

		.bis-motion-ready {
			scroll-behavior: smooth;
		}

		@media (prefers-reduced-motion: no-preference) {
			.bis-motion-ready [data-bis-reveal] {
				opacity: 0;
				transform: translate3d(0, var(--bis-offset, 24px), 0) scale(var(--bis-scale, 0.985));
				filter: blur(8px);
				transition:
					opacity 760ms var(--bis-motion-ease),
					transform 860ms var(--bis-motion-ease),
					filter 860ms var(--bis-motion-ease);
				transition-delay: var(--bis-delay, 0ms);
				will-change: opacity, transform, filter;
			}

			.bis-motion-ready [data-bis-reveal].bis-in {
				opacity: 1;
				transform: translate3d(0, 0, 0) scale(1);
				filter: blur(0);
			}

			.bis-motion-ready .top-nav {
				animation: bisNavIn 820ms var(--bis-motion-ease) both;
			}

			.bis-motion-ready .hero > * {
				opacity: 0;
				animation: bisHeroLift 900ms var(--bis-motion-ease) both;
			}

			.bis-motion-ready .hero > *:nth-child(1) {
				animation-delay: 140ms;
			}

			.bis-motion-ready .hero > *:nth-child(2) {
				animation-delay: 240ms;
			}

			.bis-motion-ready .hero > *:nth-child(3) {
				animation-delay: 320ms;
			}

			.bis-motion-ready .nav-item,
			.bis-motion-ready .theme-toggle,
			.bis-motion-ready .tab-btn,
			.bis-motion-ready .sport-tab,
			.bis-motion-ready .season-tab,
			.bis-motion-ready .gender-tab,
			.bis-motion-ready .details-button,
			.bis-motion-ready .subscribe-btn,
			.bis-motion-ready .vote-btn,
			.bis-motion-ready .accordion-header,
			.bis-motion-ready .team-switch-btn,
			.bis-motion-ready .formation-tab,
			.bis-motion-ready .color-code {
				transition:
					transform 280ms var(--bis-motion-ease),
					box-shadow 320ms ease,
					background-color 320ms ease,
					border-color 320ms ease,
					color 320ms ease,
					opacity 320ms ease;
			}

			.bis-motion-ready .logo,
			.bis-motion-ready .bobcat-img-main,
			.bis-motion-ready .team-vs img,
			.bis-motion-ready .team-logo,
			.bis-motion-ready .mascot,
			.bis-motion-ready .uniform-img {
				transition:
					transform 420ms var(--bis-motion-ease),
					filter 320ms ease,
					box-shadow 320ms ease;
			}

			.bis-motion-ready .panel,
			.bis-motion-ready .section-card,
			.bis-motion-ready .card,
			.bis-motion-ready .split-panel,
			.bis-motion-ready .hs-card,
			.bis-motion-ready .match-card,
			.bis-motion-ready .retro-item,
			.bis-motion-ready .color-item,
			.bis-motion-ready .stream,
			.bis-motion-ready .vote-section,
			.bis-motion-ready .formation-court-wrapper,
			.bis-motion-ready .formation-pitch {
				transition:
					transform 420ms var(--bis-motion-ease),
					box-shadow 420ms ease,
					border-color 320ms ease,
					background-color 320ms ease;
				transform-origin: 50% 70%;
			}

			.bis-motion-ready .nav-item {
				position: relative;
			}

			.bis-motion-ready .nav-item::after {
				content: '';
				position: absolute;
				left: 0;
				right: 0;
				bottom: -6px;
				height: 2px;
				background: currentColor;
				opacity: 0;
				transform: scaleX(0.4);
				transform-origin: center;
				transition: transform 280ms var(--bis-motion-ease), opacity 280ms ease;
			}

			@media (hover: hover) and (pointer: fine) {
				.bis-motion-ready .nav-item:hover,
				.bis-motion-ready .nav-item:focus-visible,
				.bis-motion-ready .theme-toggle:hover,
				.bis-motion-ready .theme-toggle:focus-visible,
				.bis-motion-ready .tab-btn:hover,
				.bis-motion-ready .sport-tab:hover,
				.bis-motion-ready .season-tab:hover,
				.bis-motion-ready .gender-tab:hover,
				.bis-motion-ready .details-button:hover,
				.bis-motion-ready .subscribe-btn:hover,
				.bis-motion-ready .vote-btn:hover,
				.bis-motion-ready .accordion-header:hover,
				.bis-motion-ready .team-switch-btn:hover,
				.bis-motion-ready .formation-tab:hover,
				.bis-motion-ready .color-code:hover {
					transform: translateY(-2px);
					box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
				}

				.bis-motion-ready .nav-item:hover::after,
				.bis-motion-ready .nav-item:focus-visible::after {
					opacity: 0.6;
					transform: scaleX(1);
				}

				.bis-motion-ready .panel:hover,
				.bis-motion-ready .section-card:hover,
				.bis-motion-ready .card:hover,
				.bis-motion-ready .split-panel:hover,
				.bis-motion-ready .hs-card:hover,
				.bis-motion-ready .match-card:hover,
				.bis-motion-ready .retro-item:hover,
				.bis-motion-ready .color-item:hover,
				.bis-motion-ready .stream:hover,
				.bis-motion-ready .vote-section:hover,
				.bis-motion-ready .formation-court-wrapper:hover,
				.bis-motion-ready .formation-pitch:hover {
					transform: translateY(-4px);
					box-shadow: 0 22px 44px rgba(15, 23, 42, 0.12);
				}

				.bis-motion-ready .logo:hover,
				.bis-motion-ready .bobcat-img-main:hover,
				.bis-motion-ready .team-vs img:hover,
				.bis-motion-ready .team-logo:hover,
				.bis-motion-ready .mascot:hover,
				.bis-motion-ready .uniform-img:hover {
					transform: translateY(-4px) scale(1.02);
					filter: saturate(1.05);
					box-shadow: 0 16px 28px rgba(15, 23, 42, 0.14);
				}
			}

			@keyframes bisNavIn {
				0% {
					opacity: 0;
					transform: translate3d(0, -14px, 0);
				}
				100% {
					opacity: 1;
					transform: translate3d(0, 0, 0);
				}
			}

			@keyframes bisHeroLift {
				0% {
					opacity: 0;
					transform: translate3d(0, 28px, 0) scale(0.985);
					filter: blur(10px);
				}
				100% {
					opacity: 1;
					transform: translate3d(0, 0, 0) scale(1);
					filter: blur(0);
				}
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.bis-motion-ready,
			.bis-motion-ready * {
				scroll-behavior: auto;
				animation: none !important;
				transition-duration: 0ms !important;
			}

			[data-bis-reveal] {
				opacity: 1 !important;
				transform: none !important;
				filter: none !important;
			}
		}
	`;

	const highLevelSelectors = [
		'.panel',
		'.section-card',
		'.card',
		'.stream',
		'.vote-section',
		'.formation-court-wrapper',
		'.formation-pitch',
		'.timeline-item',
		'.match-card',
		'.hs-card',
		'.split-panel',
		'.retro-item',
		'.color-item'
	];

	const gridContainerSelector = '[class*="grid"], [class*="list"], .uniform-gallery, .accordion';
	const skippedContainerPattern = /(gender-tabs|season-tabs|tabs|nav-|top-nav|tab-panels|panel-title|panel-subtitle|top-actions|vote-bar|formation-tabs|team-formation-switch|calendar-)/;
	const skippedItemSelector = '.panel-title, .panel-subtitle, .theme-toggle-wrap, .toggle-icon, .toggle-text, script, style';

	function injectStyles() {
		if (document.getElementById(styleId)) return;
		const style = document.createElement('style');
		style.id = styleId;
		style.textContent = animationCss;
		document.head.appendChild(style);
	}

	function shouldReduceMotion() {
		return reduceMotionQuery.matches;
	}

	function syncMotionClass() {
		root.classList.toggle('bis-motion-ready', !shouldReduceMotion());
	}

	function computeDelay(index, step, maxSteps) {
		const normalizedIndex = maxSteps > 0 ? index % maxSteps : index;
		return `${normalizedIndex * step}ms`;
	}

	function markRevealTarget(element, delay, offset) {
		if (!(element instanceof HTMLElement)) return;
		if (element.dataset.bisRevealReady === '1') return;
		if (element.matches(skippedItemSelector)) return;
		element.dataset.bisReveal = '';
		element.dataset.bisRevealReady = '1';
		element.style.setProperty('--bis-delay', delay);
		element.style.setProperty('--bis-offset', offset);
		element.style.setProperty('--bis-scale', '0.985');
	}

	function revealSoon(element) {
		if (!(element instanceof HTMLElement)) return;
		if (element.dataset.bisShown === '1') return;
		element.dataset.bisShown = '1';
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				element.classList.add('bis-in');
			});
		});
	}

	function shouldRevealImmediately(element) {
		const rect = element.getBoundingClientRect();
		return rect.top <= window.innerHeight * 0.92;
	}

	function observeTarget(element) {
		if (!(element instanceof HTMLElement)) return;
		if (shouldReduceMotion()) {
			element.classList.add('bis-in');
			return;
		}
		if (shouldRevealImmediately(element)) {
			revealSoon(element);
			return;
		}
		if (!revealObserver && 'IntersectionObserver' in window) {
			revealObserver = new IntersectionObserver((entries) => {
				entries.forEach((entry) => {
					if (!entry.isIntersecting && entry.intersectionRatio <= 0) return;
					entry.target.classList.add('bis-in');
					entry.target.dataset.bisShown = '1';
					revealObserver.unobserve(entry.target);
				});
			}, {
				threshold: 0.16,
				rootMargin: '0px 0px -12% 0px'
			});
		}
		if (revealObserver) {
			revealObserver.observe(element);
		} else {
			revealSoon(element);
		}
	}

	function registerStandaloneTargets(scope) {
		highLevelSelectors.forEach((selector) => {
			const elements = scope.querySelectorAll(selector);
			elements.forEach((element, index) => {
				if (element.closest('[data-bis-no-reveal]')) return;
				markRevealTarget(element, computeDelay(index, 90, 4), '24px');
				observeTarget(element);
			});
		});
	}

	function registerGridChildren(scope) {
		const containers = scope.querySelectorAll(gridContainerSelector);
		containers.forEach((container) => {
			if (container.closest('[data-bis-no-reveal]')) return;
			const classText = typeof container.className === 'string' ? container.className : '';
			if (skippedContainerPattern.test(classText)) return;
			const children = Array.from(container.children).filter((child) => {
				return child instanceof HTMLElement && !child.matches(skippedItemSelector) && !child.classList.contains('panel-title') && !child.classList.contains('panel-subtitle');
			});
			if (children.length < 2 || children.length > 14) return;
			children.forEach((child, index) => {
				markRevealTarget(child, computeDelay(index, 70, 6), '18px');
				observeTarget(child);
			});
		});
	}

	function scanDocument() {
		syncMotionClass();
		registerStandaloneTargets(document);
		registerGridChildren(document);
		if (shouldReduceMotion()) {
			document.querySelectorAll('[data-bis-reveal]').forEach((element) => {
				element.classList.add('bis-in');
				element.dataset.bisShown = '1';
			});
		}
	}

	function scheduleScan() {
		if (scanFrame) return;
		scanFrame = requestAnimationFrame(() => {
			scanFrame = 0;
			scanDocument();
		});
	}

	function attachMutationObserver() {
		if (!document.body || mutationObserver) return;
		mutationObserver = new MutationObserver((mutations) => {
			const hasElementAddition = mutations.some((mutation) => {
				return Array.from(mutation.addedNodes).some((node) => node instanceof HTMLElement);
			});
			if (hasElementAddition) scheduleScan();
		});
		mutationObserver.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	function handleMotionPreferenceChange() {
		syncMotionClass();
		scheduleScan();
	}

	injectStyles();
	scanDocument();
	attachMutationObserver();

	if (typeof reduceMotionQuery.addEventListener === 'function') {
		reduceMotionQuery.addEventListener('change', handleMotionPreferenceChange);
	} else if (typeof reduceMotionQuery.addListener === 'function') {
		reduceMotionQuery.addListener(handleMotionPreferenceChange);
	}

	window.addEventListener('load', scheduleScan, { once: true });
	window.addEventListener('resize', scheduleScan);
})();