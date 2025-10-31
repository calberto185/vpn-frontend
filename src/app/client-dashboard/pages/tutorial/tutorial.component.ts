import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tutorial.component.html',
  styleUrl: './tutorial.component.css'
})
export class TutorialComponent {
  @Input() companyName = 'TuEmpresa';
  @Input() portalUrl = 'https://portal.tuempresa.com';
  @Input() downloadsUrl = 'https://portal.tuempresa.com/descargas';
  @Input() supportEmail = 'soporte@tuempresa.com';

  os = signal<'windows'|'macos'|'android'|'ios'|'linux'>('windows');
  osList: Array<'windows'|'macos'|'android'|'ios'|'linux'> = ['windows','macos','android','ios','linux'];

  // Imágenes SVG inline (data URI) para mantener el componente autocontenido
  svg(kind: 'signup' | 'plans' | 'devices' | 'download' | 'import' | 'phone' | 'terminal' | 'connect') {
    const base = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`
      <svg xmlns='http://www.w3.org/2000/svg' width='800' height='480'>
        <defs>
          <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stop-color='#f8fafc'/>
            <stop offset='100%' stop-color='#eef2f7'/>
          </linearGradient>
        </defs>
        <rect width='100%' height='100%' fill='url(#g)'/>
        ${body}
      </svg>
    `)}`;

    const title = (t: string) => `<text x='24' y='40' font-size='22' font-family='Inter, Arial, sans-serif' fill='#111827'>${t}</text>`;
    const windowChrome = `<rect x='20' y='60' rx='12' ry='12' width='760' height='360' fill='white' stroke='#e5e7eb'/>
      <circle cx='48' cy='80' r='6' fill='#ef4444'/>
      <circle cx='66' cy='80' r='6' fill='#f59e0b'/>
      <circle cx='84' cy='80' r='6' fill='#10b981'/>`;

    const list = (x:number, y:number, items:string[]) => items.map((t,i)=>`<rect x='${x}' y='${y + i*42}' width='520' height='28' rx='6' fill='${i===0?'#111827':'#f3f4f6'}' stroke='#e5e7eb'/>
      <text x='${x+12}' y='${y + i*42 + 19}' font-size='14' font-family='Inter, Arial' fill='${i===0?'#ffffff':'#374151'}'>${t}</text>`).join('');

    switch(kind){
      case 'signup':
        return base(`${title('Crear cuenta')} ${windowChrome}
          <rect x='60' y='120' width='320' height='40' rx='8' fill='#f3f4f6'/>
          <rect x='60' y='170' width='320' height='40' rx='8' fill='#f3f4f6'/>
          <rect x='60' y='220' width='320' height='40' rx='8' fill='#f3f4f6'/>
          <rect x='60' y='270' width='160' height='42' rx='10' fill='#111827'/>
          <text x='84' y='297' font-size='16' fill='white' font-family='Inter, Arial'>Crear cuenta</text>
        `);
      case 'plans':
        return base(`${title('Elegir plan')} ${windowChrome}
          ${list(60,130,['Plan Básico','Plan Pro','Plan Empresa'])}
          <rect x='620' y='130' width='120' height='32' rx='8' fill='#111827'/>
          <text x='640' y='151' font-size='14' fill='white' font-family='Inter, Arial'>Elegir</text>
        `);
      case 'devices':
        return base(`${title('Dispositivos')} ${windowChrome}
          ${list(60,130,['Mac oficina','Android personal','Windows Casa'])}
          <rect x='620' y='130' width='120' height='32' rx='8' fill='#111827'/>
          <text x='642' y='151' font-size='14' fill='white' font-family='Inter, Arial'>Agregar</text>
        `);
      case 'download':
        return base(`${title('Descargar .ovpn')} ${windowChrome}
          <rect x='60' y='130' width='540' height='32' rx='8' fill='#f3f4f6'/>
          <rect x='620' y='130' width='120' height='32' rx='8' fill='#111827'/>
          <text x='632' y='151' font-size='14' fill='white' font-family='Inter, Arial'>Descargar</text>
        `);
      case 'import':
        return base(`${title('Importar perfil')} ${windowChrome}
          <rect x='60' y='130' width='680' height='220' rx='8' fill='#f9fafb' stroke='#e5e7eb'/>
          <text x='80' y='160' font-size='14' fill='#374151' font-family='Inter, Arial'>Arrastra y suelta tu archivo .ovpn aquí</text>
        `);
      case 'phone':
        return base(`${title('Móvil - Importar')}
          <rect x='140' y='100' width='280' height='480' rx='32' fill='white' stroke='#e5e7eb'/>
          <rect x='170' y='150' width='220' height='16' rx='4' fill='#f3f4f6'/>
          <rect x='170' y='180' width='220' height='280' rx='10' fill='#f9fafb' stroke='#e5e7eb'/>
          <text x='190' y='340' font-size='14' fill='#374151' font-family='Inter, Arial'>Importar .ovpn</text>
        `);
      case 'terminal':
        return base(`${title('Linux - Terminal')} ${windowChrome}
          <rect x='60' y='120' width='680' height='280' rx='8' fill='#0b1220'/>
          <text x='80' y='160' font-size='14' fill='#a7f3d0' font-family='Menlo, monospace'>$ sudo openvpn --config perfil.ovpn</text>
          <text x='80' y='185' font-size='14' fill='#93c5fd' font-family='Menlo, monospace'>Initialization Sequence Completed</text>
        `);
      case 'connect':
        return base(`${title('Conectar a la VPN')} ${windowChrome}
          <rect x='350' y='160' width='100' height='100' rx='50' fill='#111827'/>
          <text x='368' y='220' font-size='14' fill='white' font-family='Inter, Arial'>ON</text>
        `);
    }
  }
}
