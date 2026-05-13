import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ReportEntity {
    @PrimaryGeneratedColumn('uuid')
    id!:string

    @Column()
    listingId!:string

    @Column()
    userId!:string

    @Column()
    reason!:string

    @CreateDateColumn()
    created_at!:Date
}