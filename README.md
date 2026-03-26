# VISOC
Visor del servei d'oceanografia de Catalunya. Aquest visor està basat en aquest informe: [Roadmap for oceanographic front-end interfaces at ICATMAR](https://docs.google.com/document/d/19ufTqTHpMZkp1xeUAx_FSPEmaMY2UE9gq6_kOrRmb-w/edit?tab=t.0#heading=h.ju92jy9h2aa)

## Framework
This project is built with vue. The files are complied on the client with[ vue3-sfc-loader](https://github.com/FranckFreiburger/vue3-sfc-loader). Instead of using professional solution like Vite, we chose vue3-sfc-loader for its longevity: the website will still work and be editable in 10 years. On the down side, compiling on the client adds a small loading overhead. For a reference, [VISAP](https://icatmar.github.io/VISAP/) takes 2 seconds to compile on a 2014 windows computer.

### TODOS
- Read about env and viewport definition to avoid buttons being hidden. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/env
