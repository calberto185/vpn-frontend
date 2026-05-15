export interface MessageDelivery {
  sent:  boolean;
  error: string | null;
}

export interface MessageAttachment {
  type:     'image' | 'video' | 'document' | 'link';
  name:     string;
  mimeType: string;
  data?:    string;   // base64 (para imagen/video/document)
  url?:     string;   // para links
  size?:    number;   // bytes
}

export default class MessageEntity {
  id           = '';
  thread_id:   string | null = null;
  reply_to_id: string | null = null;
  type         = 'admin_to_client'; // 'admin_to_client' | 'client_to_admin'
  from_id      = '';
  from_name    = '';
  to: string[] | 'all' = [];
  to_label     = '';
  subject      = '';
  body         = '';
  attachments: MessageAttachment[] = [];
  channels: string[] = ['in_app'];
  delivery = {
    email:    { sent: false, error: null } as MessageDelivery,
    telegram: { sent: false, error: null } as MessageDelivery,
    whatsapp: { sent: false, error: null } as MessageDelivery,
  };
  read_by: string[] = [];
  createdAt  = new Date();
  updatedAt  = new Date();

  constructor() {}

  set(data: Partial<MessageEntity> & Record<string, any>) {
    this.id          = data['id']          ?? this.id;
    this.thread_id   = data['thread_id']   ?? this.thread_id;
    this.reply_to_id = data['reply_to_id'] ?? this.reply_to_id;
    this.type        = data['type']        ?? this.type;
    this.from_id     = data['from_id']     ?? this.from_id;
    this.from_name   = data['from_name']   ?? this.from_name;
    this.to          = data['to']          ?? this.to;
    this.to_label    = data['to_label']    ?? this.to_label;
    this.subject     = data['subject']     ?? this.subject;
    this.body        = data['body']        ?? this.body;
    this.attachments = data['attachments'] ?? this.attachments;
    this.channels    = data['channels']    ?? this.channels;
    this.delivery    = data['delivery']    ?? this.delivery;
    this.read_by     = data['read_by']     ?? this.read_by;
    this.createdAt   = data['createdAt'] ? new Date(data['createdAt']) : this.createdAt;
    this.updatedAt   = data['updatedAt'] ? new Date(data['updatedAt']) : this.updatedAt;
    return this;
  }

  isReadBy(userId: string): boolean {
    return this.read_by.includes(userId);
  }
}
