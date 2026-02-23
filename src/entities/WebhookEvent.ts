import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity({ name: 'webhook_events' })
export class WebhookEvent {
  @PrimaryColumn({ name: 'event_id', type: 'text' })
  eventId!: string

  @Column({ name: 'event_type', type: 'text' })
  eventType!: string

  @Column({ type: 'jsonb' })
  payload!: object

  @Column({
    name: 'received_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  receivedAt!: Date
}
