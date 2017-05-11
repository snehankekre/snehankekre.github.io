---
layout: post
title:  "Using Docker for Remote Machine Learning"
date:   2015-1-30 00:20:13
categories: docker machine learning ml pipeline
image: 
        feature: docker.jpg
comments: true
overlay-alpha: .5
published: false
---
Often times when building a machine learning model, training takes a long time. This can be due to a large dataset, the computational complexity of the classifier or any nontrivial amount of data manipulation. Any dataset so large it even can't fit into RAM is generally considered in the realm of big data. Don't follow this post if you have big data you're training on. Stop reading and go setup a Hive-Hadoop cluster or something. But anything in the realm of small to large-ish data can be done with traditional single machine computing. Here it doesn't really pay to set up a remote distributed system for optimal runtime as this takes a non-trivial amount of engineering and can be time-consuming. This post aims to solve the case of what to do in the middle-ground between small and big data. Small enough to fit on a single computer, but training takes many many hours. Building these models on your personal computer, while perfectly possible, is not ideal because anything you use your computer for potentially slows down your training. So instead we're going to set up a remote host and train on that. And we're going to use docker to manage the container. TLDR: Don't abuse your personal computer, train your classifiers on a remote server and use Docker to manage your container.

### Docker

Docker is a new VM container paradigm thats picking up a lot of popularity.

### Steps

First install Docker - boring.

Now make your Dockerfile.

``touch Dockerfile``

Fill the Dockerfile as below:

    # DOCKER-VERSION 1.1.2
    FROM namsangboy/ipython-scikit
    COPY . /src


Now for remote services. I chose Digital Ocean because it was the most convenient. Not free, but pretty cheap.

So first ssh in to your remote machine.

``ssh root@104.236.112.230``

Next, clone your repo in:

``git clone https://github.com/nicholaslocascio/kaggle-mnist-digits.git``

But wait, my data is .gitignored so it won't work. Scp to the rescue:
``scp -r Projects/ML/kaggle-digits/data root@104.236.112.230:~/kaggle-mnist-digits``

Now we can create our Docker image from the Dockerfile in our repo.
``docker build -t kaggle-digits-image kaggle-mnist-digits``

The first argument is the name we give to the docker image we are creating. The second argument is the path to the directory containing the Dockerfile.



Enjoy!
