import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('user_reset_tokens')

export class UserResetTokens {
    @PrimaryGeneratedColumn('uuid')
    id:string

    @Column()
    token:string

    @CreateDateColumn({type: "date"})
    created_at:Date
        
    @Column({ type: 'timestamp' })
  expired_at: Date

    @Column()
    userId:string
}