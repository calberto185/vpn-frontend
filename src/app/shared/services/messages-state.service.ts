import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Singleton bus that messages components use to tell layout components
 * "this message was just read" so they can remove it from the bell preview
 * and decrement the unread badge — without a fresh HTTP round-trip.
 */
@Injectable({ providedIn: 'root' })
export class MessagesStateService {
  private readonly readSubject      = new Subject<string>();
  private readonly decrementSubject = new Subject<void>();

  /** Emits the id of a message that was just marked as read. */
  readonly messageRead$      = this.readSubject.asObservable();

  /** Emits once every time an unread message is read (bell counter should go down by 1). */
  readonly unreadDecrement$  = this.decrementSubject.asObservable();

  markAsRead(id: string): void {
    this.readSubject.next(id);
  }

  /** Call this when an unread message is actually opened/read. */
  decrementUnread(): void {
    this.decrementSubject.next();
  }
}
