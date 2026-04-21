FROM php:8.3-apache

RUN apt-get update \
    && apt-get install -y --no-install-recommends default-mysql-client libonig-dev \
    && docker-php-ext-install pdo_mysql mbstring mysqli \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/entrypoint.sh /usr/local/bin/web1-entrypoint
RUN chmod +x /usr/local/bin/web1-entrypoint

COPY . /var/www/html

RUN mkdir -p /var/www/html/backend/public/uploads \
    && chown -R www-data:www-data /var/www/html/backend/public/uploads

EXPOSE 80

ENTRYPOINT ["web1-entrypoint"]
CMD ["apache2-foreground"]
