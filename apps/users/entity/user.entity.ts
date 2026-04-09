  import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';

   @Entity()
   export class Users {
     @PrimaryGeneratedColumn("uuid")
     id!: string;

     @Column()
     username!: string;

     @Column({unique:true})
     email!: string;

     @Column()
     password!: string;

     @Column()
     role!: string;

     @Column()
     status!: string;

     @Column({ nullable: true })
     
     phone!: string;

     @Column({ nullable: true })
     location!: string;

     @Column({ nullable: true })
     avatar_url?: string;

     @Column({ nullable: true })
     avatar_public_id?: string;

     @CreateDateColumn({type:'date'})
      created_at!: Date;
   }