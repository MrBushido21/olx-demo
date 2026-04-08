import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity() 
@Index(["userId", "active"])
export class Listings {
    @PrimaryGeneratedColumn('uuid')
    id!:string

    @Index()
    @Column()
    userId!:string

    @Index()
    @Column()
    listing_title!:string

    @Column()
    listing_decription!:string

    @Column()
    listing_location!:string

    @Column()
    listing_username!:string

    @Column()
    listing_category!:string

    @Column({type: 'jsonb'})
    listing_atributes!: Record<string, any>

    @Column({type: 'enum', enum: ["active", "hidden"], default: "active"})
    active!: "active" | "hidden"

    @Column({ nullable: true })
    listing_phone?:string

    @Column({ default: 0 })
    views?:number

    @Column({ default: 0 })
    likes?:number

    @Column({ default: 0 })
    chates?:number

    @CreateDateColumn()
    created_at!:Date

    @Column()
    expired_at!:Date
}

