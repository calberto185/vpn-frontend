import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import jsPDF from 'jspdf';
import { addSignedFooter } from '../../utils/pdf-signature.util';

@Component({
  selector: 'app-payment-summary',
  imports: [],
  templateUrl: './payment-summary.component.html',
  styleUrl: './payment-summary.component.css'
})
export class PaymentSummaryComponent implements OnChanges{


  @Input() selectedPlan: any;
  @Input() selectedCountries: any[] = [];
  @Input() paymentMethod: any;

  ngOnChanges(changes: SimpleChanges): void {
    console.log("this.selectedPlan:  ", this.selectedPlan )
    console.log("this.selectedCountries:  ", this.selectedCountries )
    console.log("this.paymentMethod:  ", this.paymentMethod )
  }
  // generatePDF() {
  //   const doc = new jsPDF();

  //   // Encabezado
  //   doc.setFontSize(18);
  //   doc.text('💳 Comprobante de Pago VPN', 20, 20);

  //   // Línea decorativa
  //   doc.setDrawColor(100, 100, 255);
  //   doc.line(20, 25, 190, 25);

  //   // Plan
  //   doc.setFontSize(14);
  //   doc.text('📦 Plan seleccionado:', 20, 40);
  //   doc.setFontSize(12);
  //   doc.text(`${this.selectedPlan?.name || 'No seleccionado'}`, 25, 48);
  //   doc.text(`Precio mensual: ${this.selectedPlan?.price || '---'} ₽`, 25, 56);
  //   doc.text(`Dispositivos: ${this.selectedPlan?.devices || '---'}`, 25, 64);

  //   // Países
  //   doc.setFontSize(14);
  //   doc.text('🌍 Países seleccionados:', 20, 80);
  //   doc.setFontSize(12);
  //   if (this.selectedCountries.length > 0) {
  //     this.selectedCountries.forEach((c, i) => {
  //       doc.text(`• ${c.flag} ${c.countryName} (${c.currencyCode})`, 25, 90 + i * 8);
  //     });
  //   } else {
  //     doc.text('No se seleccionaron países', 25, 90);
  //   }

  //   // Método de pago
  //   doc.setFontSize(14);
  //   doc.text('💰 Método de pago:', 20, 120);
  //   doc.setFontSize(12);
  //   doc.text(`${this.paymentMethod?.name || 'No seleccionado'}`, 25, 128);
  //   doc.text(`Número de cuenta / tarjeta: ${this.paymentMethod?.account || '---'}`, 25, 136);
  //   doc.text(`Titular: ${this.paymentMethod?.owner || '---'}`, 25, 144);

  //   // Total
  //   doc.setFontSize(16);
  //   doc.text('TOTAL:', 20, 165);
  //   doc.setTextColor(0, 128, 0);
  //   doc.text(`${this.selectedPlan?.price || 0} ₽`, 50, 165);
  //   doc.setTextColor(0, 0, 0);

  //   // Pie
  //   doc.setFontSize(10);
  //   doc.text('Gracias por su compra. Conserve este comprobante como referencia.', 20, 190);

  //   // Descargar
  //   doc.save('Comprobante_Pago_VPN.pdf');
  // }
  async generatePDF() {
    const doc = new jsPDF();
    const serial = Date.now().toString(36).toUpperCase();

    // Encabezado
    doc.setFontSize(18);
    doc.text('Comprobante de Pago VPN', 20, 20);

    // Línea decorativa
    doc.setDrawColor(100, 100, 255);
    doc.line(20, 25, 190, 25);

    // Plan
    doc.setFontSize(14);
    doc.text('Plan seleccionado:', 20, 40);
    doc.setFontSize(12);
    doc.text(`${this.selectedPlan?.name || 'No seleccionado'}`, 25, 48);
    doc.text(`Precio mensual: ${this.selectedPlan?.price || '---'} RUB`, 25, 56);
    doc.text(`Dispositivos: ${this.selectedPlan?.devices || '---'}`, 25, 64);

    // Países
    doc.setFontSize(14);
    doc.text('Paises seleccionados:', 20, 80);
    doc.setFontSize(12);
    if (this.selectedCountries.length > 0) {
      this.selectedCountries.forEach((c, i) => {
        doc.text(`• ${c.countryName} (${c.currencyCode})`, 25, 90 + i * 8);
      });
    } else {
      doc.text('No se seleccionaron paises', 25, 90);
    }

    // Método de pago
    doc.setFontSize(14);
    doc.text('Metodo de pago:', 20, 120);
    doc.setFontSize(12);
    doc.text(`${this.paymentMethod?.name || 'No seleccionado'}`, 25, 128);
    doc.text(`Numero de cuenta / tarjeta: ${this.paymentMethod?.account || '---'}`, 25, 136);
    doc.text(`Titular: ${this.paymentMethod?.owner || '---'}`, 25, 144);

    // Total
    doc.setFontSize(16);
    doc.text('TOTAL:', 20, 165);
    doc.setTextColor(0, 128, 0);
    doc.text(`${this.selectedPlan?.price || 0} RUB`, 50, 165);
    doc.setTextColor(0, 0, 0);

    // ── Signed footer (all pages) ──
    await addSignedFooter(doc, serial, serial);

    // Descargar
    doc.save('Comprobante_Pago_VPN.pdf');
  }

}
