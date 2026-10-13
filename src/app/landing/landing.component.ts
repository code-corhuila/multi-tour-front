import { afterNextRender, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/** The public home of a tenant (the Mockup "Home"): no session, every way in leads to the sign-in route of the portal. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './landing.component.css',
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  protected readonly identifier = inject(ActivatedRoute).snapshot.paramMap.get('identifier') ?? '';

  protected readonly signIn = `/t/${this.identifier}/ingresar`;
  protected readonly operatorQuery = { tab: 'operador' };

  constructor() {
    afterNextRender(() => this.startMotion());
  }

  /** The skip link must not be a `#` href: with `<base href="/">` it would leave the page. */
  protected skip(event: Event): void {
    event.preventDefault();
    const main = this.host.querySelector<HTMLElement>('#contenido');
    main?.focus();
  }

  /** Decorative only: header border once scrolled, and reveal on scroll. Nothing is hidden if the observer never fires. */
  private startMotion(): void {
    if (typeof IntersectionObserver === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timers: number[] = [];
    const observers: IntersectionObserver[] = [];
    const header = this.host.querySelector('.mth-header');
    const sentinel = this.host.querySelector('.mth-scroll-sentinel');
    if (header && sentinel) {
      const scroll = new IntersectionObserver((e) => header.classList.toggle('is-scrolled', !e[0].isIntersecting));
      scroll.observe(sentinel);
      observers.push(scroll);
    }
    const reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          reveal.unobserve(entry.target);
        }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );
    observers.push(reveal);
    this.host.querySelectorAll<HTMLElement>('.mth-reveal').forEach((el, index) => {
      if (el.getBoundingClientRect().top < innerHeight * 1.1) return;
      el.style.setProperty('--mth-reveal-delay', `${Math.min(index % 3, 2) * 70}ms`);
      el.classList.add('mth-pending');
      reveal.observe(el);
      timers.push(window.setTimeout(() => el.classList.add('is-visible'), 1500));
    });
    this.destroyRef.onDestroy(() => {
      observers.forEach((o) => o.disconnect());
      timers.forEach((t) => clearTimeout(t));
    });
  }
}