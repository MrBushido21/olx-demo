import { ConfigService } from "@nestjs/config";

export const TypeOrmModuleConf = (database:string, entities:any[]) => {
    return {
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get(database),
        entities: entities,
        synchronize: true,
      }),
      inject: [ConfigService],
    }
} 