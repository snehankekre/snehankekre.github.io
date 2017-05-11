---
layout: post
title:  "Multiple User API Keys in Rails"
date:   2014-10-25 00:20:00
categories: rails api
image: 
        feature: keys.jpg
overlay-alpha: .5
description: Because one is never enough.
published: false
comments: true
---
So you want to make an API for a mobile app. But you want your users to be able to sign in on multiple devices. The solution: Multiple User API Tokens.

### Migration

We need to make an Authentication Token table in our db, so run:

{% highlight ruby %}
rails g migration CreateAuthenticationToken
{% endhighlight %}

We want the authentication token to have a token, belong to a user, and have an expiration datetime. So our migration looks like:

{% highlight ruby %}
    class CreateAuthenticationToken < ActiveRecord::Migration
      def change
        create_table :authentication_tokens do |t|
          t.string :token
          t.integer :user_id
          t.datetime :expires_at
          t.timestamps
        end
        add_index :authentication_tokens, :token
      end
    end
{% endhighlight %}

### Model
Lets set up our Authentication Token Model.
{% highlight ruby %}
    class AuthenticationToken < ActiveRecord::Base
      attr_accessible :token
      before_create :generate_token
      before_create :set_expiration
      belongs_to :user

      private

      def generate_token
        begin
          self.token = SecureRandom.hex
        end while self.class.exists?(token: token)
      end

      def set_expiration
        self.expires_at = 3.weeks.from_now
      end
    end
{% endhighlight %}

Pretty straightforward. We generate a random, unique token and set it to expire in 3 weeks. It belongs to user so we need to add the following to user.rb:
{% highlight ruby %}
    has_many :authentication_tokens
{% endhighlight %}

### API Design

This api was made in addition to an already existing web app. As such, I wanted to re-use the models I had already defined but create new controllers. This required that I create a folder /api in my controller folder and a /v1 within the /api folder for proper versioning. If you follow this structure of controllers/api/v1, add the following to your routes.rb

## API

{% highlight ruby %}
    scope module: 'api' do
      scope '/api' do
        scope module: 'v1' do
          scope '/v1' do
            resources :authentication_tokens #your other models here as well
          end
        end
      end
    end
{% endhighlight %}

With this, we're going to create an API controller that will be for our API what ApplicationController is for our web app. We do this because there are some differences in authentication for the API and the web app. I'm using Devise for authentication of the web app. The web app uses devise's sessions for authentication, so its current_user method looks at the session. With the API's approach, there is no session, so it must look at the authentication_token for authentication. So to solve this problem, we will make an ApiController which all controllers in our API will inherit from.
{% highlight ruby %}
    module Api
      module V1
        class ApiController < ActionController::Base
          protect_from_forgery

          alias_method :devise_current_user, :current_user
          def current_user
            authenticate_or_request_with_http_token do |token, options|
              if token.blank?
                return nil
              else
                auth_key = AuthenticationToken.find_by_token(token)
                return auth_key.user
              end
            end
          end

          protected

        end
      end
    end
{% endhighlight %}

So we override devise's current_user method and make it lookup via the authentication token. We look at the authorization header for the token so it is not passed in the url and not accidentally shared via copy/paste.

### Controller

Now for our Authentication Controller. We need to define our RESTful actions.
{% highlight ruby %}
    module Api
      module V1
        class AuthenticationTokensController  < ApiController
          def create
            email = params[:email]
            password = params[:password]

            if email.nil? or password.nil?
              render :status=>400,
                :json=>{:message=>"The request must contain the user email and password."}
              return
            end

            @user=User.find_by_email(email.downcase)

            if @user.nil?
              render :status=>401, :json=>{:message=>"Invalid email or passoword."}
              return
            end

            if not @user.valid_password?(password)
              render :status=>401, :json=>{:message=>"Invalid email or password."}
            else
              @auth_token = AuthenticationToken.new
              @user.authentication_tokens << @auth_token
              @user.save!
              render :status=>200, :json=>{:auth_token=> @auth_token.token, user: @user}
            end
          end

          def destroy
            @auth_token = AuthenticationToken.find_by_token(params[:auth_token])
            if @auth_token.nil?
              render :status=>404, :json=>{:message=>'Invalid token.'}
            else
              @auth_token.destroy
              render :status=>200, :json=>{:message=>'Token destroyed.'}
            end
          end
        end
      end
    end
{% endhighlight %}

Again, pretty straightforward. If valid username/password passed with POST, create new authentication token and return it along with the user. If valid authentication_token passed with DELETE, destroy the authentication token.

### Closing thoughts:

The unfortunate thing about multiple user tokens is that it takes two queries to retrieve the user from an authentication_token. With a single token, we can index the user on the authentication_token which means only 1 query. But with a single token, if a user signs in on a different device, he is logged out of the other device. So, consider the tradeoffs...

Enjoy!
