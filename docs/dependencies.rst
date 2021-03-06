.. _dependencies:

Dependencies on operator's machine
--------------------------------------------------------------------

.. warning::

    If you already installed Wire by using ``poetry``, please refer to the
    `old version </versions/install-with-poetry/how-to/index.html>`__ of
    the installation guide.

In order to operate a wire-server installation, you'll need a bunch of software
like Ansible, ``kubectl`` and Helm. We provide a way to get all the needed
dependencies for setting up and interacting with a wire-server cluster.

Before anything else, we need to install the tools we will need:

.. note: this is only used when running the test script repeatedly, to clean up the workspace so the commands can cleanly be run again, this should be removed once we have a way to properly "zero" the servers before each run
.. test-step {name: exiting in case we are still in the docker container, commands: [exit], on: client, execute: true}
.. test-step {name: clean up before running commands, commands: [rm -rf /root/*], on: client, execute: true}

.. note: should this be visible as an actual step? it's required in the script only for re-runs so we don't go to root@arthur2:~/wire-server-deploy/ansible/wire-server-deploy/ansible/wire-server
.. test-step {name: move to home folder, commands: [cd ~], on: client, after_should_be_in: /root, execute: true}

.. test-step {name: apt update and install git, commands: from-next-code-block, on: client, execute: true}
.. code:: shell

   sudo apt update
   sudo apt install git

All dependencies for the ``wire-server-deploy`` project are managed using Git submodules,
`Nix <https://nixos.org>`__ and `Direnv <https://direnv.net>`__.
We also provide a pre-built Docker container image with all the dependencies.

Step one is to fetch a release of ``wire-server-deploy`` and make sure all submodules are
updated. This fetches all the required Ansible roles needed to run the wire Ansible playbooks.

.. test-step {name: git clone and init, commands: from-next-code-block, on: client, after_should_be_in: /root/wire-server-deploy, execute: true}
.. code:: shell

   git clone --branch master https://github.com/wireapp/wire-server-deploy.git
   cd wire-server-deploy
   git submodule update --init --recursive

.. note: check if the right files are present after running this command
.. test-step {name: check if folder contains the right files, commands: [ls -l], on: client, must_contain: Dockerfile, execute: true}

Next, there are two ways to get all the required binaries for operating Wire.


(Option 1) Installing dependencies using Direnv and Nix
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

1. `Install Nix <https://nixos.org/download.html>`__
2. `Install Direnv <https://direnv.net/docs/installation.html>`__
3. `Optionally install the Wire cachix cache to download binaries <https://app.cachix.org/cache/wire-server-deploy>`__

Now, enabling ``direnv`` should install all the dependencies and add them to your ``PATH``. Every time you ``cd`` into
the ``wire-server-deploy`` directory, the right dependencies will be available.

.. code:: shell

   direnv allow

   ansible --version
   ansible 2.9.12


(Option 2) Installing dependencies using Docker image
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

We provide a Docker container image containing all the dependencies.
On your machine you need to have the ``docker`` binary available. Run:

.. test-step {name: apt install of docker, commands: from-next-code-block, on: client, in: wire-server-deploy, execute: true}
.. code:: shell

   sudo apt install docker.io

Or see `how to install docker <https://docker.com>`__.

Then, after downloading your copy of ``wire-server-deploy``, you can run the container when you're in the ``wire-server-deploy``
directory to have all the dependencies and commands available needed for the deployment.

.. test-step {name: running docker command so we then execute commands inside container, commands: from-next-code-block, on: client, execute: true}
.. code:: shell

   WSD_CONTAINER=quay.io/wire/wire-server-deploy:cdc1c84c1a10a4f5f1b77b51ee5655d0da7f9518
   sudo docker run -it --network=host \
        -v ${SSH_AUTH_SOCK:-nonexistent}:/ssh-agent \
        -v $HOME/.ssh:/root/.ssh \
        -v $PWD:/wire-server-deploy \
        -e SSH_AUTH_SOCK=/ssh-agent \
        $WSD_CONTAINER bash

Once inside the container, make sure everything is working and you have the right version of ansible by running:

.. test-step {name: checking ansible version, commands: from-next-code-block, on: client, must_contain: ansible 2.9.12, execute: true}

.. code:: shell

   # Inside the container
   ansible --version

The answer should be:

.. code:: shell

   ansible 2.9.12

Once you have gone through with either of these options, you can move on to `installing kubernetes </how-to/install/kubernetes.html>`__


