Вот что у тебя реализовано:        
                                                                                                         
  ---                                     
  Сервис Auth
  
  (порт3000)                                                                                
                                                                                                           Отвечает за аутентификацию.                                                                            
                                                                                                           Реализовано:                                                                                           
  - POST /auth/register-link — создаёт токен подтверждения и возвращает ссылку регистрации                 - POST /auth/register — завершает регистрацию, создаёт юзера через RabbitMQ, выдаёт JWT                
  - POST /auth/login — вход, проверяет пароль через RabbitMQ, выдаёт JWT:
  - POST /auth/reset — сброс пароля
  - POST /auth/changepassword — смена пароля по токену

  Таблицы: user_refresh_tokens, user_verify_codes, user_reset_tokens

  ---
  Сервис Users (порт 3002)

  Хранилище пользователей. Нет HTTP эндпоинтов — только RabbitMQ.

  Реализовано:
  - user.created — создать юзера
  - user.findByEmail — найти по email
  - user.findById — найти по ID
  - PATCH /auth/changeuserinfo — обновление профиля (требует авторизацию)

  Таблица: users

  ---
  Сервис Listings (порт 3001)

  Объявления. Все маршруты требуют авторизацию.

  Реализовано:
  - GET /listings — список своих объявлений
  - GET /listings/:id — получить объявление + инкремент просмотров
  - POST /listings/create — создать объявление с валидацией атрибутов
  - POST /listings/match-categories — определить категорию по ключевым словам
  - PATCH /listings/:id — редактировать
  - PATCH /listings/hidden/:id — скрыть объявление
  - PATCH /listings/like/:id — лайк
  - PUT /listings/activate/:id — активировать
  - DELETE /listings/:id — удалить

  Категории: clothes, phones с валидацией атрибутов

  Таблицы: listings, listing_images

  ---
  Инфраструктура

  - PostgreSQL — 3 отдельные БД на каждый сервис
  - RabbitMQ — межсервисное взаимодействие auth ↔ users
  - JWT — access token (1ч) + refresh token (7д) в cookie
  - Swagger — на каждом сервисе

  ---

  Что уже есть                                                                                                                                                                                                    
  Auth: регистрация, логин, сброс пароля, смена инфо пользователя                                        

  Users: CRUD пользователя через RabbitMQ, смена инфо

  Listings: создание, редактирование, удаление, скрыть/активировать, лайк, просмотры, поиск, фильтры,    
  категории

  ---
  Чего не хватает

  Auth:
  - refresh — нет обновления access_token по refresh_token из cookie. Сейчас если access_token истёк (1  
  час) — пользователь выбит и должен логиниться заново
  - GET /auth/me — получить данные текущего пользователя по токену

  Listings:
  - Загрузка изображений — таблица ListingImages есть, но эндпоинтов для загрузки/удаления картинок нет  
  - like работает только в одну сторону — нельзя убрать лайк
---
  Из этого самое критичное — refresh токен и проверка владельца при изменении объявлений