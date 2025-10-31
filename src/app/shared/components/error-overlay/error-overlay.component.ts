import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-error-overlay',
  imports: [],
  templateUrl: './error-overlay.component.html',
  styleUrl: './error-overlay.component.css'
})
export class ErrorOverlayComponent {

  @Input() isVisible = false;
  @Input() title = 'Error al cargar la página';
  @Input() message = 'Ocurrió un problema al obtener los datos.';
  @Output() onChange = new EventEmitter()

  reloadPage() {
    this.onChange.emit({
      isVisible: this.isVisible,
      title: this.title,
      message: this.message,
      onChange: this.onChange,
    })
    // window.location.reload();
  }
}
