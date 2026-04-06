import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
@Entity('user_verify_codes')
export class UserVerifyCodes {
    @PrimaryGeneratedColumn('uuid')
    id:string
    
    @Column()
    token:string

    @Column()
    user_email:string

    @CreateDateColumn({type: "date"})
    created_at:Date
    
    @Column({type: "date"})
    expired_at:Date
}