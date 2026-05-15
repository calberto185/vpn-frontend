import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CountryLocale {
  id: string;
  countryName: string;
  languageName: string;
  languageCode: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  currencyFormat: string;
  flag: string;
}

export interface SystemLanguage {
  id: string;
  code: string;        // ISO 639-1
  name: string;        // English name
  nativeName: string;  // Native name
  flag: string;
  isActive: boolean;
  isDefault: boolean;
  order: number;
}

// ── Static translations ───────────────────────────────────────────────────────

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    // ── Navegación cliente ────────────────────────────────
    'nav.dashboard':    'Dashboard',
    'nav.tutorial':     'Tutorial',
    'nav.devices':      'Dispositivos',
    'nav.payments':     'Pagos',
    'nav.profile':      'Mi perfil',
    'nav.preferences':  'Preferencias',
    'nav.logout':       'Salir',
    'nav.my_services':  'Mis Servicios',
    'nav.choose_plan':  'Elige el plan que mejor te convenga!',
    // ── Dashboard cliente ─────────────────────────────────
    'dashboard.title':            'Resumen global',
    'dashboard.subtitle':         'Estado de servicios, pagos y actividad.',
    'dashboard.breadcrumb_panel': 'Panel',
    'dashboard.add_service':      'Agregar Servicio',
    'dashboard.active':           'Activo',
    'dashboard.inactive':         'Inactivo',
    'dashboard.punctual':         '🙂 Puntal',
    'dashboard.late':             '🙁 Impuntual',
    'dashboard.payments_advance': 'pago(s) adelantado(s)',
    'dashboard.recent_activity':  'Actividad reciente',
    'dashboard.current_session':  'Sesión actual',
    'dashboard.connected':        'Conectado',
    'dashboard.login_start':      'Inicio de sesión:',
    'dashboard.token_issued':     'token emitido',
    'dashboard.expires':          'Expira:',
    'dashboard.valid':            'Vigente',
    'dashboard.expired':          'Expirado',
    'dashboard.browser_device':   'Navegador / Dispositivo',
    'dashboard.each':             'de cada',
    // ── Navbar público ────────────────────────────────────
    'pub.nav.advantages':     'Ventajas',
    'pub.nav.how_it_works':   'Cómo funciona',
    'pub.nav.prices':         'Precios',
    'pub.nav.security':       'Seguridad',
    'pub.nav.create_account': 'Crear cuenta',
    'pub.nav.login':          'Iniciar sesión',
    // ── Hero ──────────────────────────────────────────────
    'pub.hero.badge':         'Servicio de protección digital activo',
    'pub.hero.title1':        'Internet privado.',
    'pub.hero.title2':        'Seguro.',
    'pub.hero.title3':        'Global.',
    'pub.hero.desc':          'Accede a cualquier plataforma del mundo a través de un canal de datos cifrado y completamente privado. Sin rastreos, sin restricciones.',
    'pub.hero.cta_start':     'Empezar gratis',
    'pub.hero.cta_plans':     'Ver planes',
    'pub.hero.feat1':         'Sin registros de actividad',
    'pub.hero.feat2':         'Cancela cuando quieras',
    'pub.hero.feat3':         '+30 países disponibles',
    'pub.hero.card_status':   'CONEXIÓN ACTIVA',
    'pub.hero.card_protected':'Protegido',
    'pub.hero.uptime_label':  'Uptime',
    'pub.hero.uptime_sub':    'Disponibilidad',
    'pub.hero.speed_label':   'Velocidad',
    'pub.hero.speed_sub':     'Latencia promedio',
    'pub.hero.coverage_label':'Cobertura',
    'pub.hero.coverage_sub':  'Países',
    'pub.hero.support_label': 'Soporte',
    'pub.hero.support_sub':   'Disponible',
    'pub.hero.enc_active':    'Cifrado activo',
    'pub.hero.global_access': 'Acceso global',
    'pub.hero.no_tracking':   'Sin rastreos',
    'pub.hero.identity':      'Identidad protegida',
    'pub.hero.invisible':     'Invisible para terceros',
    // ── Stats ─────────────────────────────────────────────
    'pub.stats.countries':    'Países disponibles',
    'pub.stats.availability': 'Disponibilidad',
    'pub.stats.support':      'Soporte técnico',
    // ── Ventajas ──────────────────────────────────────────
    'pub.adv.label':    'Por qué elegirnos',
    'pub.adv.title':    'Todo lo que necesitas para navegar con libertad',
    'pub.adv.desc':     'Tecnología de privacidad diseñada para el uso diario, sin complicaciones técnicas.',
    'pub.adv.f1_title': 'Cifrado de extremo a extremo',
    'pub.adv.f1_desc':  'Tu tráfico viaja completamente cifrado desde tu dispositivo hasta el destino final.',
    'pub.adv.f2_title': 'Política estricta de cero registros',
    'pub.adv.f2_desc':  'No almacenamos historial de navegación ni datos de actividad.',
    'pub.adv.f3_title': 'Acceso a internet global',
    'pub.adv.f3_desc':  'Conéctate a cualquiera de nuestros nodos en más de 30 países.',
    'pub.adv.f4_title': 'Alta velocidad garantizada',
    'pub.adv.f4_desc':  'Infraestructura de 10 Gbps con enrutamiento optimizado.',
    'pub.adv.f5_title': 'Todos tus dispositivos',
    'pub.adv.f5_desc':  'Un plan protege todos tus equipos a la vez.',
    'pub.adv.f6_title': 'Soporte técnico 24/7',
    'pub.adv.f6_desc':  'Equipo de soporte disponible en cualquier momento.',
    // ── Cómo funciona ─────────────────────────────────────
    'pub.how.label':       'Proceso',
    'pub.how.title':       'Activo en menos de 5 minutos',
    'pub.how.desc':        'Sin instalaciones complicadas. Funciona desde el primer clic.',
    'pub.how.step1_title': 'Crea tu cuenta',
    'pub.how.step1_desc':  'Regístrate en menos de un minuto.',
    'pub.how.step2_title': 'Elige tu plan',
    'pub.how.step2_desc':  'Selecciona el plan que mejor se ajuste a tus necesidades.',
    'pub.how.step3_title': 'Conéctate y navega',
    'pub.how.step3_desc':  'Descarga nuestra aplicación y activa tu protección.',
    // ── Seguridad ─────────────────────────────────────────
    'pub.sec.label':         'Tecnología',
    'pub.sec.title':         'Privacidad de nivel corporativo para todos',
    'pub.sec.desc':          'Usamos la misma tecnología de seguridad que protege las grandes corporaciones.',
    'pub.sec.f1_title':      'Cifrado de grado bancario',
    'pub.sec.f1_desc':       'El mismo estándar de cifrado que utilizan los bancos.',
    'pub.sec.f2_title':      'Desconexión de seguridad automática',
    'pub.sec.f2_desc':       'Si tu conexión se interrumpe, el sistema bloquea cualquier tráfico expuesto.',
    'pub.sec.f3_title':      'Infraestructura propia',
    'pub.sec.f3_desc':       'Todos nuestros nodos de acceso son propios.',
    'pub.sec.f4_title':      'Protección de identidad de red',
    'pub.sec.f4_desc':       'Todas las peticiones van cifradas a través de nuestros servidores privados.',
    'pub.sec.card_title':    'Estado de la protección',
    'pub.sec.all_systems':   'Todos los sistemas operativos',
    'pub.sec.layer_enc':     'Capa de cifrado',
    'pub.sec.identity_prot': 'Protección de identidad',
    'pub.sec.auto_disc':     'Desconexión automática',
    'pub.sec.own_nodes':     'Nodos propios verificados',
    'pub.sec.zero_logs':     'Política de cero registros',
    'pub.sec.active':        'Activa',
    'pub.sec.guarantee':     'Tu privacidad está completamente garantizada',
    'pub.sec.guarantee_sub': 'Protección activa · Sin registros · Sin rastreos',
    // ── Precios ───────────────────────────────────────────
    'pub.prices.label':       'Planes',
    'pub.prices.title':       'Precios simples y transparentes',
    'pub.prices.desc':        'Sin contratos. Sin sorpresas. Cancela cuando quieras.',
    'pub.prices.per':         'por',
    'pub.prices.popular':     'Más popular',
    'pub.prices.guarantee':   'Garantía 7 días',
    'pub.prices.secure':      'Pago seguro',
    'pub.prices.no_contract': 'Sin permanencia',
    'pub.prices.worldwide':   'Disponible en todo el mundo',
    // ── CTA ───────────────────────────────────────────────
    'pub.cta.title':      'Empieza a navegar con privacidad',
    'pub.cta.desc':       '7 días de garantía de devolución. Sin permanencia. Sin preguntas.',
    'pub.cta.btn_create': 'Crear cuenta gratuita',
    'pub.cta.btn_plans':  'Ver planes',
    'pub.cta.sub':        'Sin tarjeta de crédito · Activación inmediata',
    // ── Footer ────────────────────────────────────────────
    'pub.footer.service':   'Servicio',
    'pub.footer.account':   'Cuenta',
    'pub.footer.legal':     'Legal',
    'pub.footer.desc':      'Servicio de privacidad y acceso seguro a internet para usuarios de todo el mundo.',
    'pub.footer.advantages':'Ventajas',
    'pub.footer.how':       'Cómo funciona',
    'pub.footer.security':  'Seguridad',
    'pub.footer.prices':    'Precios',
    'pub.footer.login':     'Iniciar sesión',
    'pub.footer.create':    'Crear cuenta',
    'pub.footer.terms':     'Términos de Servicio',
    'pub.footer.privacy':   'Política de Privacidad',
    'pub.footer.refund':    'Política de reembolso',
    'pub.footer.bottom':    'Privacidad garantizada · Sin registros de actividad · Infraestructura global',
    // ── Navegación pública ────────────────────────────────
    'pub.nav.content':      'Contenido',
    'pub.nav.plans':        'Planes',
    'pub.nav.back_top':     'Volver arriba',
    'pub.nav.sections':     'Secciones',
    'pub.loading':          'Cargando contenido público',
    'pub.loading_sub':      'Estamos preparando la vista principal.',
    // ── Auth — Login ──────────────────────────────────────
    'auth.login.title':       'Iniciar Sesión',
    'auth.login.email':       'Correo electrónico',
    'auth.login.email_ph':    'Escribe tu correo',
    'auth.login.email_err':   'Correo electrónico inválido.',
    'auth.login.password':    'Contraseña',
    'auth.login.password_ph': 'Escribe tu contraseña',
    'auth.login.password_err':'Debe tener al menos 8 caracteres e incluir número, minúscula y mayúscula.',
    'auth.login.forgot':      '¿Olvidaste tu contraseña?',
    'auth.login.verifying':   'Verificando...',
    'auth.login.submit':      'Iniciar sesión',
    'auth.login.or':          'ó',
    // ── Auth — Register ───────────────────────────────────
    'auth.register.badge':        'Comienza en 5 minutos',
    'auth.register.title':        'Crea tu cuenta y protege tu conexión',
    'auth.register.subtitle':     'Cifrado de nivel empresarial, baja latencia y estricta No-Logs policy.',
    'auth.register.privacy_title':'Privacidad primero',
    'auth.register.privacy_sub':  'AES-256 · TLS 1.3 · PFS · Kill Switch',
    'auth.register.why_title':    '¿Por qué registrarte?',
    'auth.register.b1':           'Conecta hasta 3 dispositivos (plan Pro) sin límites de ancho de banda.',
    'auth.register.b2':           'No-Logs: no registramos tu actividad.',
    'auth.register.b3':           'Baja latencia optimizada para streaming y gaming.',
    'auth.register.b4':           'Servidores en múltiples países de LATAM.',
    'auth.register.faq_title':    'Preguntas frecuentes',
    'auth.register.faq1_q':       '¿Puedo cancelar cuando quiera?',
    'auth.register.faq1_a':       'Sí, no hay permanencia. Puedes cancelar antes del siguiente ciclo.',
    'auth.register.faq2_q':       '¿Guardan registros de mi actividad?',
    'auth.register.faq2_a':       'No. Política estrictamente No-Logs. Solo conservamos lo mínimo para operar.',
    'auth.register.faq3_q':       '¿Qué dispositivos son compatibles?',
    'auth.register.faq3_a':       'Windows, macOS, Linux, Android, iOS y perfiles .ovpn.',
    'auth.register.no_commit':    'Crea tu cuenta para empezar tu prueba. Sin permanencia.',
    'auth.register.form_title':   'Registrarme ahora',
    'auth.register.firstnames':   'Nombres',
    'auth.register.firstnames_ph':'Escribe tus nombres',
    'auth.register.firstnames_err':'Ingresa tus nombres.',
    'auth.register.lastnames':    'Apellidos',
    'auth.register.lastnames_ph': 'Escribe tus apellidos',
    'auth.register.lastnames_err':'Ingresa tus apellidos.',
    'auth.register.country':      'País',
    'auth.register.country_ph':   'Selecciona tu país de origen',
    'auth.register.country_err':  'Seleccione un país.',
    'auth.register.telephone':    'Teléfono',
    'auth.register.password':     'Contraseña',
    'auth.register.password_ph':  'Crea tu contraseña',
    'auth.register.processing':   'Procesando...',
    'auth.register.submit':       'Empezar ahora',
    'auth.register.or':           'ó',
    // ── Auth — Reset password ─────────────────────────────
    'auth.reset.title':         'Resetear Contraseña',
    'auth.reset.email':         'Correo electrónico',
    'auth.reset.email_ph':      'Escribe tu correo',
    'auth.reset.email_err':     'Correo electrónico inválido.',
    'auth.reset.submit':        'Resetear Cuenta',
    'auth.reset.success_title': '¡Cuenta reseteada con éxito!',
    'auth.reset.success_msg':   'Su cuenta fue reseteada exitosamente. Revise su bandeja de correo',
    'auth.reset.back_login':    '← Volver al inicio de sesión',
    // ── Client layout extras ──────────────────────────────
    'nav.notifications':       'Notificaciones',
    'nav.all_up_to_date':      'Todo al día',
    'nav.no_new_messages':     'No hay mensajes nuevos',
    'nav.see_all_messages':    'Ver todos los mensajes',
    'nav.messages':            'Mensajes',
    'nav.my_account':          'Mi cuenta',
    'nav.communication':       'Comunicación',
    'nav.support':             'Soporte',
    'nav.resources':           'Recursos',
    // ── Language management (admin) ───────────────────────
    'lang.title':           'Gestión de idiomas',
    'lang.subtitle':        'Controla los idiomas disponibles en todos los módulos',
    'lang.add':             'Agregar idioma',
    'lang.active':          'Activo',
    'lang.hidden':          'Oculto',
    'lang.default':         'Por defecto',
    'lang.set_default':     'Establecer por defecto',
    'lang.toggle_active':   'Activar / Ocultar',
    'lang.delete':          'Eliminar',
    'lang.confirm_delete':  '¿Eliminar este idioma?',
    'lang.code':            'Código',
    'lang.name':            'Nombre',
    'lang.native':          'Nombre nativo',
    'lang.flag':            'Bandera',
    'lang.order':           'Orden',
    // ── Admin nav ─────────────────────────────────────────
    'admin.nav.users':            'Usuarios',
    'admin.nav.certificates':     'Certificados',
    'admin.nav.activity':         'Actividad',
    'admin.nav.crm':              'CRM',
    'admin.nav.roles':            'Roles',
    'admin.nav.suppliers':        'Proveedores',
    'admin.nav.supplier_payments':'Pagos a proveedores',
    'admin.nav.finance':          'Finanzas',
    'admin.nav.tutorial':         'Tutorial de Uso',
    'admin.nav.settings':         'Settings',
    'admin.nav.servers':          'Servidores',
    'admin.nav.countries':        'Países',
    'admin.nav.plans':            'Planes',
    'admin.nav.bank_accounts':    'Cuentas Bancarias',
    'admin.nav.services':         'Servicios',
    'admin.nav.terms':            'Términos',
    'admin.nav.public_landing':   'Landing público',
    'admin.nav.apps':             'Apps',
    'admin.nav.languages':        'Idiomas',
    'admin.nav.translations':     'Traducciones',
    'admin.nav.routes':           'Rutas del sistema',
    'admin.nav.client_messages':  'Mensajes de clientes',
    'admin.nav.no_new':           'Sin nuevos',
    'admin.nav.no_new_body':      'Sin mensajes nuevos',
    'admin.nav.see_all':          'Ver todos los mensajes →',
  },

  en: {
    'nav.dashboard':    'Dashboard',
    'nav.tutorial':     'Tutorial',
    'nav.devices':      'Devices',
    'nav.payments':     'Payments',
    'nav.profile':      'My profile',
    'nav.preferences':  'Preferences',
    'nav.logout':       'Sign out',
    'nav.my_services':  'My Services',
    'nav.choose_plan':  'Choose the plan that best suits you!',
    'dashboard.title':            'Global overview',
    'dashboard.subtitle':         'Service, payments and activity status.',
    'dashboard.breadcrumb_panel': 'Panel',
    'dashboard.add_service':      'Add Service',
    'dashboard.active':           'Active',
    'dashboard.inactive':         'Inactive',
    'dashboard.punctual':         '🙂 On time',
    'dashboard.late':             '🙁 Late',
    'dashboard.payments_advance': 'advance payment(s)',
    'dashboard.recent_activity':  'Recent activity',
    'dashboard.current_session':  'Current session',
    'dashboard.connected':        'Connected',
    'dashboard.login_start':      'Login time:',
    'dashboard.token_issued':     'token issued',
    'dashboard.expires':          'Expires:',
    'dashboard.valid':            'Valid',
    'dashboard.expired':          'Expired',
    'dashboard.browser_device':   'Browser / Device',
    'dashboard.each':             'every',
    'pub.nav.advantages':     'Advantages',
    'pub.nav.how_it_works':   'How it works',
    'pub.nav.prices':         'Prices',
    'pub.nav.security':       'Security',
    'pub.nav.create_account': 'Create account',
    'pub.nav.login':          'Sign in',
    'pub.hero.badge':         'Digital protection service active',
    'pub.hero.title1':        'Private internet.',
    'pub.hero.title2':        'Secure.',
    'pub.hero.title3':        'Global.',
    'pub.hero.desc':          'Access any platform in the world through a fully encrypted and private data channel.',
    'pub.hero.cta_start':     'Start for free',
    'pub.hero.cta_plans':     'View plans',
    'pub.hero.feat1':         'No activity logs',
    'pub.hero.feat2':         'Cancel anytime',
    'pub.hero.feat3':         '+30 countries available',
    'pub.hero.card_status':   'ACTIVE CONNECTION',
    'pub.hero.card_protected':'Protected',
    'pub.hero.uptime_label':  'Uptime',
    'pub.hero.uptime_sub':    'Availability',
    'pub.hero.speed_label':   'Speed',
    'pub.hero.speed_sub':     'Average latency',
    'pub.hero.coverage_label':'Coverage',
    'pub.hero.coverage_sub':  'Countries',
    'pub.hero.support_label': 'Support',
    'pub.hero.support_sub':   'Available',
    'pub.hero.enc_active':    'Encryption active',
    'pub.hero.global_access': 'Global access',
    'pub.hero.no_tracking':   'No tracking',
    'pub.hero.identity':      'Protected identity',
    'pub.hero.invisible':     'Invisible to third parties',
    'pub.stats.countries':    'Countries available',
    'pub.stats.availability': 'Availability',
    'pub.stats.support':      'Technical support',
    'pub.adv.label':    'Why choose us',
    'pub.adv.title':    'Everything you need to browse freely',
    'pub.adv.desc':     'Privacy technology designed for daily use.',
    'pub.adv.f1_title': 'End-to-end encryption',
    'pub.adv.f1_desc':  'Your traffic travels fully encrypted from your device to the final destination.',
    'pub.adv.f2_title': 'Strict no-logs policy',
    'pub.adv.f2_desc':  'We do not store browsing history or activity data.',
    'pub.adv.f3_title': 'Global internet access',
    'pub.adv.f3_desc':  'Connect to any of our nodes in over 30 countries.',
    'pub.adv.f4_title': 'High speed guaranteed',
    'pub.adv.f4_desc':  '10 Gbps infrastructure with optimized routing.',
    'pub.adv.f5_title': 'All your devices',
    'pub.adv.f5_desc':  'One plan protects all your equipment at once.',
    'pub.adv.f6_title': '24/7 Technical support',
    'pub.adv.f6_desc':  'Support team available at any time.',
    'pub.how.label':       'Process',
    'pub.how.title':       'Active in less than 5 minutes',
    'pub.how.desc':        'No complicated installations.',
    'pub.how.step1_title': 'Create your account',
    'pub.how.step1_desc':  'Sign up in less than a minute.',
    'pub.how.step2_title': 'Choose your plan',
    'pub.how.step2_desc':  'Select the plan that best fits your needs.',
    'pub.how.step3_title': 'Connect and browse',
    'pub.how.step3_desc':  'Download our app and activate your protection.',
    'pub.sec.label':         'Technology',
    'pub.sec.title':         'Corporate-level privacy for everyone',
    'pub.sec.desc':          'We use the same security technology that protects large corporations.',
    'pub.sec.f1_title':      'Bank-grade encryption',
    'pub.sec.f1_desc':       'The same encryption standard used by banks.',
    'pub.sec.f2_title':      'Automatic security disconnect',
    'pub.sec.f2_desc':       'If your connection drops, the system blocks exposed traffic automatically.',
    'pub.sec.f3_title':      'Own infrastructure',
    'pub.sec.f3_desc':       'All our access nodes are our own.',
    'pub.sec.f4_title':      'Network identity protection',
    'pub.sec.f4_desc':       'All requests go encrypted through our private servers.',
    'pub.sec.card_title':    'Protection status',
    'pub.sec.all_systems':   'All operating systems',
    'pub.sec.layer_enc':     'Encryption layer',
    'pub.sec.identity_prot': 'Identity protection',
    'pub.sec.auto_disc':     'Automatic disconnect',
    'pub.sec.own_nodes':     'Verified own nodes',
    'pub.sec.zero_logs':     'Zero logs policy',
    'pub.sec.active':        'Active',
    'pub.sec.guarantee':     'Your privacy is completely guaranteed',
    'pub.sec.guarantee_sub': 'Active protection · No logs · No tracking',
    'pub.prices.label':       'Plans',
    'pub.prices.title':       'Simple and transparent pricing',
    'pub.prices.desc':        'No contracts. No surprises. Cancel anytime.',
    'pub.prices.per':         'per',
    'pub.prices.popular':     'Most popular',
    'pub.prices.guarantee':   '7-day guarantee',
    'pub.prices.secure':      'Secure payment',
    'pub.prices.no_contract': 'No commitment',
    'pub.prices.worldwide':   'Available worldwide',
    'pub.cta.title':      'Start browsing privately',
    'pub.cta.desc':       '7-day money-back guarantee. No commitment.',
    'pub.cta.btn_create': 'Create free account',
    'pub.cta.btn_plans':  'View plans',
    'pub.cta.sub':        'No credit card · Immediate activation',
    'pub.footer.service':   'Service',
    'pub.footer.account':   'Account',
    'pub.footer.legal':     'Legal',
    'pub.footer.desc':      'Privacy and secure internet access service for users worldwide.',
    'pub.footer.advantages':'Advantages',
    'pub.footer.how':       'How it works',
    'pub.footer.security':  'Security',
    'pub.footer.prices':    'Prices',
    'pub.footer.login':     'Sign in',
    'pub.footer.create':    'Create account',
    'pub.footer.terms':     'Terms of Service',
    'pub.footer.privacy':   'Privacy Policy',
    'pub.footer.refund':    'Refund Policy',
    'pub.footer.bottom':    'Privacy guaranteed · No activity logs · Global infrastructure',
    'pub.nav.content':      'Content',
    'pub.nav.plans':        'Plans',
    'pub.nav.back_top':     'Back to top',
    'pub.nav.sections':     'Sections',
    'pub.loading':          'Loading public content',
    'pub.loading_sub':      'We are preparing the main view.',
    'auth.login.title':       'Sign In',
    'auth.login.email':       'Email',
    'auth.login.email_ph':    'Enter your email',
    'auth.login.email_err':   'Invalid email address.',
    'auth.login.password':    'Password',
    'auth.login.password_ph': 'Enter your password',
    'auth.login.password_err':'Must have at least 8 characters including a number, lowercase and uppercase.',
    'auth.login.forgot':      'Forgot your password?',
    'auth.login.verifying':   'Verifying...',
    'auth.login.submit':      'Sign in',
    'auth.login.or':          'or',
    'auth.register.badge':        'Get started in 5 minutes',
    'auth.register.title':        'Create your account and protect your connection',
    'auth.register.subtitle':     'Enterprise-grade encryption, low latency and strict No-Logs policy.',
    'auth.register.privacy_title':'Privacy first',
    'auth.register.privacy_sub':  'AES-256 · TLS 1.3 · PFS · Kill Switch',
    'auth.register.why_title':    'Why register?',
    'auth.register.b1':           'Connect up to 3 devices (Pro plan) without bandwidth limits.',
    'auth.register.b2':           'No-Logs: we do not record your activity.',
    'auth.register.b3':           'Low latency optimized for streaming and gaming.',
    'auth.register.b4':           'Servers in multiple countries.',
    'auth.register.faq_title':    'Frequently asked questions',
    'auth.register.faq1_q':       'Can I cancel anytime?',
    'auth.register.faq1_a':       'Yes, no commitment. You can cancel before the next billing cycle.',
    'auth.register.faq2_q':       'Do you keep activity logs?',
    'auth.register.faq2_a':       'No. Our policy is strictly No-Logs. We only keep the minimum needed to operate.',
    'auth.register.faq3_q':       'What devices are supported?',
    'auth.register.faq3_a':       'Windows, macOS, Linux, Android, iOS and .ovpn profiles.',
    'auth.register.no_commit':    'Create your account to start your trial. No commitment.',
    'auth.register.form_title':   'Sign up now',
    'auth.register.firstnames':   'First names',
    'auth.register.firstnames_ph':'Enter your first names',
    'auth.register.firstnames_err':'Enter your first names.',
    'auth.register.lastnames':    'Last names',
    'auth.register.lastnames_ph': 'Enter your last names',
    'auth.register.lastnames_err':'Enter your last names.',
    'auth.register.country':      'Country',
    'auth.register.country_ph':   'Select your country',
    'auth.register.country_err':  'Select a country.',
    'auth.register.telephone':    'Phone',
    'auth.register.password':     'Password',
    'auth.register.password_ph':  'Create your password',
    'auth.register.processing':   'Processing...',
    'auth.register.submit':       'Get started',
    'auth.register.or':           'or',
    'auth.reset.title':         'Reset Password',
    'auth.reset.email':         'Email',
    'auth.reset.email_ph':      'Enter your email',
    'auth.reset.email_err':     'Invalid email address.',
    'auth.reset.submit':        'Reset Account',
    'auth.reset.success_title': 'Account reset successfully!',
    'auth.reset.success_msg':   'Your account has been reset. Check your inbox at',
    'auth.reset.back_login':    '← Back to sign in',
    'nav.notifications':       'Notifications',
    'nav.all_up_to_date':      'All up to date',
    'nav.no_new_messages':     'No new messages',
    'nav.see_all_messages':    'View all messages',
    'nav.messages':            'Messages',
    'nav.my_account':          'My account',
    'nav.communication':       'Communication',
    'nav.support':             'Support',
    'nav.resources':           'Resources',
    'lang.title':           'Language management',
    'lang.subtitle':        'Control available languages across all modules',
    'lang.add':             'Add language',
    'lang.active':          'Active',
    'lang.hidden':          'Hidden',
    'lang.default':         'Default',
    'lang.set_default':     'Set as default',
    'lang.toggle_active':   'Toggle visibility',
    'lang.delete':          'Delete',
    'lang.confirm_delete':  'Delete this language?',
    'lang.code':            'Code',
    'lang.name':            'Name',
    'lang.native':          'Native name',
    'lang.flag':            'Flag',
    'lang.order':           'Order',
    // ── Admin nav ─────────────────────────────────────────
    'admin.nav.users':            'Users',
    'admin.nav.certificates':     'Certificates',
    'admin.nav.activity':         'Activity',
    'admin.nav.crm':              'CRM',
    'admin.nav.roles':            'Roles',
    'admin.nav.suppliers':        'Suppliers',
    'admin.nav.supplier_payments':'Supplier payments',
    'admin.nav.finance':          'Finance',
    'admin.nav.tutorial':         'Usage Tutorial',
    'admin.nav.settings':         'Settings',
    'admin.nav.servers':          'Servers',
    'admin.nav.countries':        'Countries',
    'admin.nav.plans':            'Plans',
    'admin.nav.bank_accounts':    'Bank Accounts',
    'admin.nav.services':         'Services',
    'admin.nav.terms':            'Terms',
    'admin.nav.public_landing':   'Public Landing',
    'admin.nav.apps':             'Apps',
    'admin.nav.languages':        'Languages',
    'admin.nav.translations':     'Translations',
    'admin.nav.routes':           'System routes',
    'admin.nav.client_messages':  'Client messages',
    'admin.nav.no_new':           'No new',
    'admin.nav.no_new_body':      'No new messages',
    'admin.nav.see_all':          'View all messages →',
  },

  ru: {
    'nav.dashboard':    'Панель',
    'nav.tutorial':     'Руководство',
    'nav.devices':      'Устройства',
    'nav.payments':     'Платежи',
    'nav.profile':      'Мой профиль',
    'nav.preferences':  'Настройки',
    'nav.logout':       'Выйти',
    'nav.my_services':  'Мои услуги',
    'nav.choose_plan':  'Выберите подходящий план!',
    'dashboard.title':            'Общий обзор',
    'dashboard.subtitle':         'Статус услуг, платежей и активности.',
    'dashboard.breadcrumb_panel': 'Панель',
    'dashboard.add_service':      'Добавить услугу',
    'dashboard.active':           'Активен',
    'dashboard.inactive':         'Неактивен',
    'dashboard.punctual':         '🙂 Своевременно',
    'dashboard.late':             '🙁 С задержкой',
    'dashboard.payments_advance': 'авансовый(е) платёж(и)',
    'dashboard.recent_activity':  'Последняя активность',
    'dashboard.current_session':  'Текущий сеанс',
    'dashboard.connected':        'Подключён',
    'dashboard.login_start':      'Вход:',
    'dashboard.token_issued':     'токен выдан',
    'dashboard.expires':          'Истекает:',
    'dashboard.valid':            'Активен',
    'dashboard.expired':          'Истёк',
    'dashboard.browser_device':   'Браузер / Устройство',
    'dashboard.each':             'каждые',
    'pub.nav.advantages':     'Преимущества',
    'pub.nav.how_it_works':   'Как работает',
    'pub.nav.prices':         'Цены',
    'pub.nav.security':       'Безопасность',
    'pub.nav.create_account': 'Создать аккаунт',
    'pub.nav.login':          'Войти',
    'pub.hero.badge':         'Сервис цифровой защиты активен',
    'pub.hero.title1':        'Приватный интернет.',
    'pub.hero.title2':        'Безопасный.',
    'pub.hero.title3':        'Глобальный.',
    'pub.hero.desc':          'Получите доступ к любой платформе через зашифрованный канал данных.',
    'pub.hero.cta_start':     'Начать бесплатно',
    'pub.hero.cta_plans':     'Смотреть планы',
    'pub.hero.feat1':         'Без журналов активности',
    'pub.hero.feat2':         'Отмена в любое время',
    'pub.hero.feat3':         '+30 стран доступно',
    'pub.hero.card_status':   'АКТИВНОЕ СОЕДИНЕНИЕ',
    'pub.hero.card_protected':'Защищён',
    'pub.hero.uptime_label':  'Аптайм',
    'pub.hero.uptime_sub':    'Доступность',
    'pub.hero.speed_label':   'Скорость',
    'pub.hero.speed_sub':     'Средняя задержка',
    'pub.hero.coverage_label':'Покрытие',
    'pub.hero.coverage_sub':  'Стран',
    'pub.hero.support_label': 'Поддержка',
    'pub.hero.support_sub':   'Доступна',
    'pub.hero.enc_active':    'Шифрование активно',
    'pub.hero.global_access': 'Глобальный доступ',
    'pub.hero.no_tracking':   'Без отслеживания',
    'pub.hero.identity':      'Защита личности',
    'pub.hero.invisible':     'Невидим для третьих лиц',
    'pub.stats.countries':    'Стран доступно',
    'pub.stats.availability': 'Доступность',
    'pub.stats.support':      'Техподдержка',
    'pub.adv.label':    'Почему мы',
    'pub.adv.title':    'Всё для свободного серфинга',
    'pub.adv.desc':     'Технология приватности для ежедневного использования.',
    'pub.adv.f1_title': 'Сквозное шифрование',
    'pub.adv.f1_desc':  'Ваш трафик полностью зашифрован от вашего устройства.',
    'pub.adv.f2_title': 'Строгая политика без логов',
    'pub.adv.f2_desc':  'Мы не храним историю браузера или данные активности.',
    'pub.adv.f3_title': 'Глобальный доступ в интернет',
    'pub.adv.f3_desc':  'Подключайтесь к любому из наших узлов в 30+ странах.',
    'pub.adv.f4_title': 'Высокая скорость гарантирована',
    'pub.adv.f4_desc':  'Инфраструктура 10 Гбит/с с оптимизированной маршрутизацией.',
    'pub.adv.f5_title': 'Все ваши устройства',
    'pub.adv.f5_desc':  'Один план защищает все ваши устройства одновременно.',
    'pub.adv.f6_title': 'Техподдержка 24/7',
    'pub.adv.f6_desc':  'Команда поддержки доступна в любое время.',
    'pub.how.label':       'Процесс',
    'pub.how.title':       'Активно менее чем за 5 минут',
    'pub.how.desc':        'Без сложных установок. Работает с первого клика.',
    'pub.how.step1_title': 'Создайте аккаунт',
    'pub.how.step1_desc':  'Зарегистрируйтесь менее чем за минуту.',
    'pub.how.step2_title': 'Выберите план',
    'pub.how.step2_desc':  'Выберите план, который лучше всего подходит.',
    'pub.how.step3_title': 'Подключитесь и просматривайте',
    'pub.how.step3_desc':  'Скачайте приложение и активируйте защиту.',
    'pub.sec.label':         'Технология',
    'pub.sec.title':         'Корпоративная приватность для всех',
    'pub.sec.desc':          'Мы используем ту же технологию безопасности крупных корпораций.',
    'pub.sec.f1_title':      'Банковское шифрование',
    'pub.sec.f1_desc':       'Тот же стандарт шифрования, что используют банки.',
    'pub.sec.f2_title':      'Автоматическое аварийное отключение',
    'pub.sec.f2_desc':       'Если соединение прерывается, система блокирует незащищённый трафик.',
    'pub.sec.f3_title':      'Собственная инфраструктура',
    'pub.sec.f3_desc':       'Все наши узлы доступа собственные.',
    'pub.sec.f4_title':      'Защита сетевой идентичности',
    'pub.sec.f4_desc':       'Все запросы шифруются через наши частные серверы.',
    'pub.sec.card_title':    'Статус защиты',
    'pub.sec.all_systems':   'Все операционные системы',
    'pub.sec.layer_enc':     'Уровень шифрования',
    'pub.sec.identity_prot': 'Защита личности',
    'pub.sec.auto_disc':     'Автоматическое отключение',
    'pub.sec.own_nodes':     'Проверенные собственные узлы',
    'pub.sec.zero_logs':     'Политика нулевых логов',
    'pub.sec.active':        'Активна',
    'pub.sec.guarantee':     'Ваша конфиденциальность полностью гарантирована',
    'pub.sec.guarantee_sub': 'Активная защита · Без логов · Без отслеживания',
    'pub.prices.label':       'Планы',
    'pub.prices.title':       'Простые и прозрачные цены',
    'pub.prices.desc':        'Без контрактов. Без сюрпризов. Отмена в любое время.',
    'pub.prices.per':         'за',
    'pub.prices.popular':     'Самый популярный',
    'pub.prices.guarantee':   'Гарантия 7 дней',
    'pub.prices.secure':      'Безопасная оплата',
    'pub.prices.no_contract': 'Без обязательств',
    'pub.prices.worldwide':   'Доступно по всему миру',
    'pub.cta.title':      'Начните приватный серфинг',
    'pub.cta.desc':       '7 дней гарантии возврата. Без обязательств.',
    'pub.cta.btn_create': 'Создать бесплатный аккаунт',
    'pub.cta.btn_plans':  'Смотреть планы',
    'pub.cta.sub':        'Без кредитной карты · Немедленная активация',
    'pub.footer.service':   'Сервис',
    'pub.footer.account':   'Аккаунт',
    'pub.footer.legal':     'Правовая',
    'pub.footer.desc':      'Сервис приватности и безопасного доступа в интернет.',
    'pub.footer.advantages':'Преимущества',
    'pub.footer.how':       'Как работает',
    'pub.footer.security':  'Безопасность',
    'pub.footer.prices':    'Цены',
    'pub.footer.login':     'Войти',
    'pub.footer.create':    'Создать аккаунт',
    'pub.footer.terms':     'Условия использования',
    'pub.footer.privacy':   'Политика конфиденциальности',
    'pub.footer.refund':    'Политика возврата',
    'pub.footer.bottom':    'Гарантия приватности · Без журналов · Глобальная инфраструктура',
    'pub.nav.content':      'Контент',
    'pub.nav.plans':        'Планы',
    'pub.nav.back_top':     'Наверх',
    'pub.nav.sections':     'Разделы',
    'pub.loading':          'Загрузка контента',
    'pub.loading_sub':      'Подготавливаем главную страницу.',
    'auth.login.title':       'Войти',
    'auth.login.email':       'Email',
    'auth.login.email_ph':    'Введите ваш email',
    'auth.login.email_err':   'Недействительный email.',
    'auth.login.password':    'Пароль',
    'auth.login.password_ph': 'Введите пароль',
    'auth.login.password_err':'Минимум 8 символов: цифра, строчная и заглавная буква.',
    'auth.login.forgot':      'Забыли пароль?',
    'auth.login.verifying':   'Проверяем...',
    'auth.login.submit':      'Войти',
    'auth.login.or':          'или',
    'auth.register.badge':        'Начало за 5 минут',
    'auth.register.title':        'Создайте аккаунт и защитите соединение',
    'auth.register.subtitle':     'Шифрование корпоративного уровня, низкая задержка и строгая No-Logs политика.',
    'auth.register.privacy_title':'Приватность прежде всего',
    'auth.register.privacy_sub':  'AES-256 · TLS 1.3 · PFS · Kill Switch',
    'auth.register.why_title':    'Почему стоит зарегистрироваться?',
    'auth.register.b1':           'Подключите до 3 устройств (план Pro) без ограничений трафика.',
    'auth.register.b2':           'No-Logs: мы не записываем вашу активность.',
    'auth.register.b3':           'Низкая задержка для стриминга и игр.',
    'auth.register.b4':           'Серверы в нескольких странах.',
    'auth.register.faq_title':    'Часто задаваемые вопросы',
    'auth.register.faq1_q':       'Можно ли отменить в любое время?',
    'auth.register.faq1_a':       'Да, без обязательств. Отменить можно до следующего цикла.',
    'auth.register.faq2_q':       'Вы храните журналы активности?',
    'auth.register.faq2_a':       'Нет. Строгая политика No-Logs. Храним только минимум для работы.',
    'auth.register.faq3_q':       'Какие устройства поддерживаются?',
    'auth.register.faq3_a':       'Windows, macOS, Linux, Android, iOS и профили .ovpn.',
    'auth.register.no_commit':    'Создайте аккаунт для начала пробного периода. Без обязательств.',
    'auth.register.form_title':   'Зарегистрироваться сейчас',
    'auth.register.firstnames':   'Имя',
    'auth.register.firstnames_ph':'Введите ваше имя',
    'auth.register.firstnames_err':'Введите ваше имя.',
    'auth.register.lastnames':    'Фамилия',
    'auth.register.lastnames_ph': 'Введите вашу фамилию',
    'auth.register.lastnames_err':'Введите вашу фамилию.',
    'auth.register.country':      'Страна',
    'auth.register.country_ph':   'Выберите страну',
    'auth.register.country_err':  'Выберите страну.',
    'auth.register.telephone':    'Телефон',
    'auth.register.password':     'Пароль',
    'auth.register.password_ph':  'Создайте пароль',
    'auth.register.processing':   'Обработка...',
    'auth.register.submit':       'Начать сейчас',
    'auth.register.or':           'или',
    'auth.reset.title':         'Сброс пароля',
    'auth.reset.email':         'Email',
    'auth.reset.email_ph':      'Введите ваш email',
    'auth.reset.email_err':     'Недействительный email.',
    'auth.reset.submit':        'Сбросить аккаунт',
    'auth.reset.success_title': 'Аккаунт успешно сброшен!',
    'auth.reset.success_msg':   'Ваш аккаунт был сброшен. Проверьте вашу почту',
    'auth.reset.back_login':    '← Вернуться ко входу',
    'nav.notifications':       'Уведомления',
    'nav.all_up_to_date':      'Всё актуально',
    'nav.no_new_messages':     'Нет новых сообщений',
    'nav.see_all_messages':    'Все сообщения',
    'nav.messages':            'Сообщения',
    'nav.my_account':          'Мой аккаунт',
    'nav.communication':       'Общение',
    'nav.support':             'Поддержка',
    'nav.resources':           'Ресурсы',
    'lang.title':           'Управление языками',
    'lang.subtitle':        'Управляйте доступными языками во всех модулях',
    'lang.add':             'Добавить язык',
    'lang.active':          'Активен',
    'lang.hidden':          'Скрыт',
    'lang.default':         'По умолчанию',
    'lang.set_default':     'Установить по умолчанию',
    'lang.toggle_active':   'Вкл / Скрыть',
    'lang.delete':          'Удалить',
    'lang.confirm_delete':  'Удалить этот язык?',
    'lang.code':            'Код',
    'lang.name':            'Название',
    'lang.native':          'Родное название',
    'lang.flag':            'Флаг',
    'lang.order':           'Порядок',
    // ── Admin nav ─────────────────────────────────────────
    'admin.nav.users':            'Пользователи',
    'admin.nav.certificates':     'Сертификаты',
    'admin.nav.activity':         'Активность',
    'admin.nav.crm':              'CRM',
    'admin.nav.roles':            'Роли',
    'admin.nav.suppliers':        'Поставщики',
    'admin.nav.supplier_payments':'Платежи поставщикам',
    'admin.nav.finance':          'Финансы',
    'admin.nav.tutorial':         'Руководство по использованию',
    'admin.nav.settings':         'Settings',
    'admin.nav.servers':          'Серверы',
    'admin.nav.countries':        'Страны',
    'admin.nav.plans':            'Планы',
    'admin.nav.bank_accounts':    'Банковские счета',
    'admin.nav.services':         'Услуги',
    'admin.nav.terms':            'Условия',
    'admin.nav.public_landing':   'Главная страница',
    'admin.nav.apps':             'Приложения',
    'admin.nav.languages':        'Языки',
    'admin.nav.translations':     'Переводы',
    'admin.nav.routes':           'Маршруты системы',
    'admin.nav.client_messages':  'Сообщения клиентов',
    'admin.nav.no_new':           'Нет новых',
    'admin.nav.no_new_body':      'Нет новых сообщений',
    'admin.nav.see_all':          'Все сообщения →',
  },

  bn: {
    'nav.dashboard':    'ড্যাশবোর্ড',
    'nav.tutorial':     'টিউটোরিয়াল',
    'nav.devices':      'ডিভাইস',
    'nav.payments':     'পেমেন্ট',
    'nav.profile':      'আমার প্রোফাইল',
    'nav.preferences':  'পছন্দসমূহ',
    'nav.logout':       'প্রস্থান করুন',
    'nav.my_services':  'আমার পরিষেবা',
    'nav.choose_plan':  'আপনার জন্য সেরা প্ল্যান বেছে নিন!',
    'dashboard.title':  'সামগ্রিক সারসংক্ষেপ',
    'dashboard.active': 'সক্রিয়',
    'dashboard.inactive': 'নিষ্ক্রিয়',
    'lang.title':       'ভাষা ব্যবস্থাপনা',
    'lang.add':         'ভাষা যোগ করুন',
  },
};

// ── Storage keys ──────────────────────────────────────────────────────────────
const STORAGE_LANG = 'app_locale_lang';
const STORAGE_COUNTRY = 'app_locale_country';
const STORAGE_TRANSLATIONS = 'app_translations_cache';
const TRANSLATIONS_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Built-in fallback languages (shown immediately, no network needed) ────────
// These mirror the seeded defaults in languageController.js.
// The API response replaces them once it arrives; if the API fails, these remain.
const FALLBACK_LANGUAGES: SystemLanguage[] = [
  { id: 'es', code: 'es', name: 'Spanish',  nativeName: 'Español', flag: '🇪🇸', isActive: true, isDefault: true,  order: 1 },
  { id: 'en', code: 'en', name: 'English',  nativeName: 'English', flag: '🇺🇸', isActive: true, isDefault: false, order: 2 },
  { id: 'ru', code: 'ru', name: 'Russian',  nativeName: 'Русский', flag: '🇷🇺', isActive: true, isDefault: false, order: 3 },
];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LocaleService {
  private http = inject(HttpClient);

  // ── Countries (for currency selection) ───────────────────────────────────
  countries = signal<CountryLocale[]>([]);

  // ── System languages — seeded with fallbacks so the selector always renders ─
  systemLanguages = signal<SystemLanguage[]>(FALLBACK_LANGUAGES);

  currentCountry = signal<CountryLocale | null>(this._restoreCountry());

  // ── Stored language as a signal so computed() reacts to changes ───────────
  private _storedLang = signal<string>(this._initLang());

  /** Active system languages only — used by the language selector in all headers */
  availableLanguages = computed(() =>
    this.systemLanguages().filter(l => l.isActive).sort((a, b) => a.order - b.order)
  );

  /** Currencies filtered by the current language */
  currenciesForLanguage = computed(() => {
    const lang = this.currentLanguageCode();
    return this.countries().filter(c => c.languageCode === lang);
  });

  currentLanguageCode = computed(() =>
    this.currentCountry()?.languageCode
    || this._storedLang()
    || this.systemLanguages().find(l => l.isDefault)?.code
    || 'es'
  );
  currentCurrencyCode   = computed(() => this.currentCountry()?.currencyCode ?? '');
  currentCurrencySymbol = computed(() => this.currentCountry()?.currencySymbol ?? '');

  /** Default language fallback code (from system languages) */
  defaultLanguageCode = computed(() =>
    this.systemLanguages().find(l => l.isDefault)?.code ?? 'es'
  );

  /** DB-loaded translations: { lang: { key: value } } — takes priority over hardcoded */
  private _dbTranslations = signal<Record<string, Record<string, string>>>({});
  private _langLoaded          = signal(false);
  private _countriesLoaded     = signal(false);
  private _translationsLoaded  = signal(false);

  // ── Loaders ───────────────────────────────────────────────────────────────

  /** Force-reload system languages (e.g. after admin CRUD) */
  reloadLanguages() {
    this._langLoaded.set(false);
    this.loadLanguages();
  }

  /** Load DB translations — checks localStorage cache (5 min TTL) first */
  loadTranslations() {
    if (this._translationsLoaded()) return;
    this._translationsLoaded.set(true);

    // Try cache
    try {
      const raw = localStorage.getItem(STORAGE_TRANSLATIONS);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < TRANSLATIONS_TTL_MS) {
          this._dbTranslations.set(data);
          return;
        }
      }
    } catch { /* ignore */ }

    // Fetch from API
    this.http.get<any>(`${baseUrl}/translations`)
      .pipe(catchError(() => of({ data: {} })))
      .subscribe(resp => {
        const data: Record<string, Record<string, string>> = resp?.data ?? {};
        this._dbTranslations.set(data);
        try {
          localStorage.setItem(STORAGE_TRANSLATIONS, JSON.stringify({ ts: Date.now(), data }));
        } catch { /* ignore */ }
      });
  }

  /** Force-reload DB translations (call after admin saves) */
  reloadTranslations() {
    try { localStorage.removeItem(STORAGE_TRANSLATIONS); } catch { /* ignore */ }
    this._translationsLoaded.set(false);
    this.loadTranslations();
  }

  /** Load active system languages from /languages API */
  loadLanguages() {
    if (this._langLoaded()) return;
    this._langLoaded.set(true);
    this.http.get<any>(`${baseUrl}/languages`)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(resp => {
        const list: SystemLanguage[] = resp.data ?? [];
        // Only replace fallbacks if API returned real data — never overwrite with empty
        if (list.length > 0) {
          this.systemLanguages.set(list);
        }
        // Auto-select default if nothing stored yet
        if (!this._storedLang()) {
          const src = list.length > 0 ? list : FALLBACK_LANGUAGES;
          const def = src.find(l => l.isDefault) ?? src[0];
          if (def) this._persistLang(def.code);
        }
      });
  }

  /** Load countries for currency selection (one-time) */
  loadCountries() {
    if (this._countriesLoaded() || this.countries().length > 0) return;
    this._countriesLoaded.set(true);
    this.http.get<any>(`${baseUrl}/countries`)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(resp => {
        const list: CountryLocale[] = (resp.data ?? []).filter(
          (c: any) => c.languageCode && c.languageCode.trim()
        );
        this.countries.set(list);
        if (!this.currentCountry() && list.length > 0) {
          const saved = this._storedLang();
          const match = saved ? list.find(c => c.languageCode === saved) : null;
          this.currentCountry.set(match ?? list[0]);
        }
      });
  }

  // ── Selectors ─────────────────────────────────────────────────────────────

  setCountryByLanguage(languageCode: string) {
    const found = this.countries().find(c => c.languageCode === languageCode);
    if (found) {
      this.currentCountry.set(found);
      this._persistLang(languageCode);
      this._persistCountry(found);
    } else {
      // Language exists in system but no country match yet — just save the code
      this._persistLang(languageCode);
    }
  }

  setCountry(country: CountryLocale) {
    this.currentCountry.set(country);
    this._persistLang(country.languageCode);
    this._persistCountry(country);
  }

  // ── Translation ───────────────────────────────────────────────────────────

  t(key: string): string {
    const lang    = this.currentLanguageCode();
    const defLang = this.defaultLanguageCode();
    const db      = this._dbTranslations();

    // DB translations take priority (admin-editable).
    // Use || so that empty strings from DB fall through to hardcoded fallbacks.
    const fromDb =
      db[lang]?.[key]    ||
      db[defLang]?.[key] ||
      db['es']?.[key];
    if (fromDb) return fromDb;

    // Hardcoded translations — always available, no network needed.
    // Use ?? here (not ||) since hardcoded values are never empty strings.
    return (
      TRANSLATIONS[lang]?.[key]    ??
      TRANSLATIONS[defLang]?.[key] ??
      TRANSLATIONS['es']?.[key]    ??
      key   // last resort: return the raw key so nothing is invisible
    );
  }

  /** Resolves an I18nStr field (plain string OR { es, en, ru } object) for the current language.
   *  Plain string → returned as-is (backward compat with non-migrated data).
   *  Object → resolved via display() with language fallback chain. */
  displayI18n(val: string | Record<string, string> | null | undefined, fallback = ''): string {
    if (val == null) return fallback;
    if (typeof val === 'string') return val || fallback;
    return this.display(val, fallback);
  }

  /** Returns the display label for a given i18n object { es:'…', en:'…', ru:'…' }
   *  Falls back through: currentLang → defaultLang → 'es' → first value → key */
  display(obj: Record<string, string> | null | undefined, fallbackKey = ''): string {
    if (!obj) return fallbackKey;
    const lang    = this.currentLanguageCode();
    const defLang = this.defaultLanguageCode();
    return (
      obj[lang] ||
      obj[defLang] ||
      obj['es'] ||
      Object.values(obj).find(v => !!v) ||
      fallbackKey
    );
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Called once at service construction — reads localStorage or detects browser language */
  private _initLang(): string {
    try {
      const stored = localStorage.getItem(STORAGE_LANG);
      if (stored) return stored;
      // First visit: detect browser language, fall back to 'es'
      const browser = (navigator.language ?? '').split('-')[0].toLowerCase();
      const supported = FALLBACK_LANGUAGES.map(l => l.code);
      const detected = supported.includes(browser) ? browser : 'es';
      localStorage.setItem(STORAGE_LANG, detected);
      return detected;
    } catch { return 'es'; }
  }

  private _restoreCountry(): CountryLocale | null {
    try {
      const raw = localStorage.getItem(STORAGE_COUNTRY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  private _persistLang(code: string) {
    try {
      localStorage.setItem(STORAGE_LANG, code);
      this._storedLang.set(code);  // keep signal in sync
    } catch { /* SSR / private mode */ }
  }

  private _persistCountry(c: CountryLocale) {
    try { localStorage.setItem(STORAGE_COUNTRY, JSON.stringify(c)); } catch { /* ignore */ }
  }
}
